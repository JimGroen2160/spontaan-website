import {defineField} from 'sanity'
import {
  imageGlowField,
  type ImageGlowValue,
} from './imageGlow'

type ManagedImageFieldOptions = {
  name: string
  title: string
  group?: string
  description?: string
  required?: boolean
  altTitle?: string
  altDescription?: string
  altRequired?: boolean
  initialGlow?: ImageGlowValue
}

export function managedImageField({
  name,
  title,
  group,
  description,
  required = false,
  altTitle = 'Alt-tekst',
  altDescription =
    'Beschrijf kort en duidelijk wat op de afbeelding te zien is.',
  altRequired = true,
  initialGlow = 'none',
}: ManagedImageFieldOptions) {
  return defineField({
    name,
    title,
    type: 'image',
    ...(group ? {group} : {}),
    ...(description ? {description} : {}),
    options: {
      hotspot: true,
    },
    ...(required
      ? {
          validation: (rule) => rule.required(),
        }
      : {}),
    fields: [
      defineField({
        name: 'alt',
        title: altTitle,
        type: 'string',
        description: altDescription,
        validation: (rule) =>
          altRequired
            ? rule.required().max(160)
            : rule.max(160),
      }),
      imageGlowField({
        name: 'glow',
        initialValue: initialGlow,
      }),
    ],
  })
}