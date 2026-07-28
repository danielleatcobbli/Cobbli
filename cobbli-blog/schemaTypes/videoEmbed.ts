import {defineField, defineType} from 'sanity'

export const videoEmbed = defineType({
  name: 'videoEmbed',
  title: 'Video',
  type: 'object',
  fields: [
    defineField({
      name: 'url',
      title: 'YouTube or Vimeo URL',
      type: 'url',
      validation: (rule) =>
        rule.required().custom((url) => {
          if (!url) return true

          try {
            const hostname = new URL(url).hostname.replace(/^www\./, '')
            return ['youtube.com', 'youtu.be', 'vimeo.com'].includes(hostname)
              ? true
              : 'Enter a YouTube or Vimeo URL'
          } catch {
            return 'Enter a valid URL'
          }
        }),
    }),
    defineField({
      name: 'caption',
      title: 'Caption',
      type: 'string',
    }),
  ],
  preview: {
    select: {
      title: 'caption',
      subtitle: 'url',
    },
    prepare({title, subtitle}) {
      return {
        title: title || 'Embedded video',
        subtitle,
      }
    },
  },
})
