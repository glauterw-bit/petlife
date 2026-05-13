"""Compressão e redimensionamento de imagens antes de salvar.
Reduz tamanho de armazenamento (Railway storage) e custo de banda.
"""
import io
from PIL import Image, ImageOps


def compress_image(
    content: bytes,
    max_dimension: int = 1600,
    quality: int = 85,
    output_format: str = "JPEG",
) -> tuple[bytes, str]:
    """Recebe bytes da imagem original, retorna (bytes_otimizados, extensao).

    - Resiza preservando aspect ratio até `max_dimension` (lado maior)
    - Auto-orienta com base em EXIF (foto de celular nao fica deitada)
    - Converte para JPEG por padrão (10-20x menor que PNG sem perda perceptível)
    - Remove metadados EXIF (privacy + economia)
    """
    img = Image.open(io.BytesIO(content))

    # Aplica rotação correta baseado em EXIF (essencial pra fotos de iPhone)
    img = ImageOps.exif_transpose(img)

    # Converte modos exoticos pra RGB (JPEG nao suporta alpha)
    if img.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        bg.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Resiza se maior que max_dimension
    img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format=output_format, quality=quality, optimize=True, progressive=True)
    return buf.getvalue(), ".jpg"


def generate_thumbnail(content: bytes, size: int = 256) -> bytes:
    """Versão miniatura para listagens (cards, sidebar)."""
    img = Image.open(io.BytesIO(content))
    img = ImageOps.exif_transpose(img)
    if img.mode != "RGB":
        img = img.convert("RGB")
    img.thumbnail((size, size), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80, optimize=True)
    return buf.getvalue()
