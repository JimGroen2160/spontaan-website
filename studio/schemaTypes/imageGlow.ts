import {defineField} from 'sanity'

export type ImageGlowValue =
  | 'none'
  | 'light'
  | 'normal'
  | 'strong'

const IMAGE_GLOW_OPTIONS = [
  {title: 'Geen', value: 'none'},
  {title: 'Licht', value: 'light'},
  {title: 'Normaal', value: 'normal'},
  {title: 'Sterk', value: 'strong'},
]

type ImageGlowFieldOptions = {
  name?: string
  group?: string
  initialValue?: ImageGlowValue
}

export function imageGlowField({
  name = 'imageGlow',
  group,
  initialValue = 'none',
}: ImageGlowFieldOptions = {}) {
  return defineField({
    name,
    title: 'Gloed over foto',
    type: 'string',
    ...(group ? {group} : {}),
    description:
      'Kies hoe sterk de gekleurde gloed over deze afbeelding moet zijn.',
    initialValue,
    options: {
      list: IMAGE_GLOW_OPTIONS,
      layout: 'radio',
    },
  })
}
