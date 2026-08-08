'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Calendar, Weight, ChevronRight } from 'lucide-react'
import { type Pet } from '@/lib/api'
import { formatAge, getSpeciesEmoji, getSpeciesLabel } from '@/lib/utils'

interface PetCardProps {
  pet: Pet
  className?: string
}

export function PetCard({ pet, className = '' }: PetCardProps) {
  return (
    <Link
      href={`/pets/${pet.id}`}
      className={`block bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 hover:border-primary-300 hover:shadow-lg transition-all group overflow-hidden ${className}`}
    >
      {/* Photo */}
      <div className="relative h-44 bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
        {pet.photo_url ? (
          <Image
            src={pet.photo_url}
            alt={pet.name}
            fill
            className="object-cover"
          />
        ) : (
          <span className="text-7xl opacity-80 group-hover:animate-paw-bounce transition-all">
            {getSpeciesEmoji(pet.species)}
          </span>
        )}
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-0.5 text-xs font-medium text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-700">
          {getSpeciesLabel(pet.species)}
        </div>
        {pet.gender && (
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-0.5 text-xs font-medium text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-700">
            {pet.gender === 'male' ? '♂ Macho' : '♀ Fêmea'}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-lg font-bold text-surface-900 dark:text-white group-hover:text-primary-600 transition-colors">
              {pet.name}
            </h3>
            {pet.breed?.name && (
              <p className="text-sm text-surface-500 dark:text-surface-400">{pet.breed.name}</p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-surface-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all mt-0.5" />
        </div>

        <div className="flex items-center gap-4 mt-3">
          {pet.birth_date && (
            <div className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatAge(pet.birth_date)}</span>
            </div>
          )}
          {pet.weight && (
            <div className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400">
              <Weight className="w-3.5 h-3.5" />
              <span>{pet.weight} kg</span>
            </div>
          )}
        </div>

        {pet.neutered !== undefined && (
          <div className="mt-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              pet.neutered ? 'bg-green-50 text-green-700' : 'bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400'
            }`}>
              {pet.neutered ? '✂ Castrado(a)' : 'Não castrado(a)'}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
