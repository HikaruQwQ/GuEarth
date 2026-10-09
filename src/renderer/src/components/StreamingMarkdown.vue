<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'

const props = defineProps<{ text: string; streaming: boolean }>()
const html = ref('')
const md = new MarkdownIt({ breaks: true, linkify: true })
md.validateLink = (url) => /^https?:\/\//i.test(url)
md.renderer.rules.link_open = (tokens, index, options, _env, self) => {
  tokens[index].attrSet('target', '_blank')
  tokens[index].attrSet('rel', 'noopener noreferrer')
  return self.renderToken(tokens, index, options)
}

let timer: ReturnType<typeof setTimeout> | undefined

function render(): void {
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
  html.value = md.render(props.text)
}

watch(() => [props.text, props.streaming] as const, () => {
  if (!props.streaming || !html.value) render()
  else if (timer === undefined) timer = setTimeout(render, 50)
}, { immediate: true })

onBeforeUnmount(() => {
  if (timer !== undefined) clearTimeout(timer)
})
</script>

<template>
  <div class="answer-text" v-html="html"></div>
</template>
