from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from database import get_db
from models import Challenge, UserChallenge, UserPoints, User, ChallengeStatusEnum
from schemas import (
    ChallengeResponse, UserChallengeResponse, UserPointsResponse, LeaderboardEntry
)
from auth import get_current_user

router = APIRouter(prefix="/gamification", tags=["Gamificação"])

POINTS_PER_LEVEL = 100


def _calculate_level(points: int) -> int:
    return max(1, points // POINTS_PER_LEVEL + 1)


@router.get("/challenges", response_model=list[ChallengeResponse])
async def list_challenges(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Challenge).order_by(Challenge.category, Challenge.points))
    return result.scalars().all()


@router.get("/challenges/user", response_model=list[UserChallengeResponse])
async def get_user_challenges(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserChallenge)
        .options(selectinload(UserChallenge.challenge))
        .where(UserChallenge.user_id == current_user.id)
        .order_by(UserChallenge.status)
    )
    return result.scalars().all()


@router.post("/challenges/{challenge_id}/start", response_model=UserChallengeResponse)
async def start_challenge(
    challenge_id: int,
    pet_id: int = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Challenge).where(Challenge.id == challenge_id))
    challenge = result.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Desafio não encontrado")

    existing_result = await db.execute(
        select(UserChallenge).where(
            UserChallenge.user_id == current_user.id,
            UserChallenge.challenge_id == challenge_id,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Desafio já iniciado")

    user_challenge = UserChallenge(
        user_id=current_user.id,
        challenge_id=challenge_id,
        pet_id=pet_id,
        status=ChallengeStatusEnum.in_progress,
        progress=0,
    )
    db.add(user_challenge)
    await db.commit()

    result = await db.execute(
        select(UserChallenge)
        .options(selectinload(UserChallenge.challenge))
        .where(UserChallenge.id == user_challenge.id)
    )
    return result.scalar_one()


@router.post("/challenges/{challenge_id}/complete", response_model=UserChallengeResponse)
async def complete_challenge(
    challenge_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserChallenge)
        .options(selectinload(UserChallenge.challenge))
        .where(
            UserChallenge.user_id == current_user.id,
            UserChallenge.challenge_id == challenge_id,
        )
    )
    user_challenge = result.scalar_one_or_none()
    if not user_challenge:
        raise HTTPException(status_code=404, detail="Desafio não iniciado")
    if user_challenge.status == ChallengeStatusEnum.completed:
        raise HTTPException(status_code=400, detail="Desafio já concluído")

    user_challenge.status = ChallengeStatusEnum.completed
    user_challenge.completed_at = datetime.utcnow()
    user_challenge.progress = 100

    points_result = await db.execute(
        select(UserPoints).where(UserPoints.user_id == current_user.id)
    )
    user_points = points_result.scalar_one_or_none()

    challenge_points = user_challenge.challenge.points if user_challenge.challenge else 0

    if user_points:
        user_points.total_points += challenge_points
        user_points.level = _calculate_level(user_points.total_points)
        badge = user_challenge.challenge.badge_icon if user_challenge.challenge else None
        if badge:
            badges = user_points.badges or []
            if badge not in badges:
                badges.append(badge)
                user_points.badges = badges
    else:
        user_points = UserPoints(
            user_id=current_user.id,
            total_points=challenge_points,
            level=_calculate_level(challenge_points),
            badges=[],
        )
        db.add(user_points)

    await db.commit()

    result = await db.execute(
        select(UserChallenge)
        .options(selectinload(UserChallenge.challenge))
        .where(UserChallenge.id == user_challenge.id)
    )
    return result.scalar_one()


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPoints, User)
        .join(User, UserPoints.user_id == User.id)
        .order_by(UserPoints.total_points.desc())
        .limit(limit)
    )
    rows = result.fetchall()

    leaderboard = []
    for rank, (points_obj, user) in enumerate(rows, start=1):
        badges = points_obj.badges or []
        leaderboard.append(
            LeaderboardEntry(
                rank=rank,
                user_id=user.id,
                user_name=user.name,
                total_points=points_obj.total_points,
                level=points_obj.level,
                badges_count=len(badges),
            )
        )
    return leaderboard


@router.get("/user/points", response_model=UserPointsResponse)
async def get_user_points(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPoints).where(UserPoints.user_id == current_user.id)
    )
    points = result.scalar_one_or_none()
    if not points:
        points = UserPoints(
            user_id=current_user.id,
            total_points=0,
            level=1,
            badges=[],
        )
        db.add(points)
        await db.commit()
        await db.refresh(points)
    return points
