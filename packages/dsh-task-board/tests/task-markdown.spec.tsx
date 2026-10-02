// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TaskMarkdown, markdownToPlainText } from '../src/client/board/task-markdown.tsx'

describe('Task Markdown presentation', () => {
  it('user reads headings, lists, emphasis, code and tables instead of delimiters', () => {
    // Given a GitHub-style task description.
    const source = '## Heading\n\n**Strong** and *emphasis*\n\n- [x] Complete\n- [ ] Pending\n\n```ts\nconst value = 1\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |'
    // When rendered in task details.
    const html = renderToStaticMarkup(<TaskMarkdown source={source} />)
    // Then semantic elements replace Markdown punctuation.
    expect(html).toContain('<h2')
    expect(html).toContain('<strong>Strong</strong>')
    expect(html).toContain('<em>emphasis</em>')
    expect(html).toContain('<pre')
    expect(html).toContain('<table')
    expect(markdownToPlainText('Fix **bug**!')).toBe('Fix bug!')
    expect(html).toContain('disabled=')
    expect(markdownToPlainText('### Steps\n- [x] Check `output`')).toBe('Steps Check output')
  })
  it('user cannot execute raw HTML or unsafe links from a task', () => {
    // Given hostile HTML, script URLs and a remote tracking image.
    const source = '<script>alert(1)</script>\n\n[bad](javascript:alert) [data](data:text/html,test) ![image](https://example.com/tracker) [safe](https://example.com)'
    // When the task is displayed.
    const html = renderToStaticMarkup(<TaskMarkdown source={source} />)
    // Then only safe explicit navigation survives and no image is fetched.
    expect(html).not.toContain('<script')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('data:text')
    expect(html).not.toContain('<img')
    expect(html).toContain('href="https://example.com/"')
    expect(html).toContain('noopener noreferrer')
  })

  it('user reads entity characters and follows links with their original query parameters', () => {
    // Given named and numeric references in text, a link and an image label.
    const source = 'A &amp; B &#38; C &#x26; D [R&amp;D](https://example.com/?a=1&amp;b=2) ![X &amp; Y](https://example.com/tracker)'
    // When the description and card summary are displayed.
    const container = document.createElement('div')
    container.innerHTML = renderToStaticMarkup(<TaskMarkdown source={source} />)
    const link = container.querySelector('a')!
    // Then references are characters, the URL preserves both parameters and the image is inert.
    expect(container.textContent).toBe('A & B & C & D R&D X & Y')
    expect(markdownToPlainText(source)).toBe('A & B & C & D R&D X & Y')
    expect([...new URL(link.href).searchParams]).toEqual([['a', '1'], ['b', '2']])
    expect(link.rel).toBe('noopener noreferrer')
    expect(container.querySelector('img')).toBeNull()
  })

  it.each(['java&#x73;cript:alert', 'javascript&#58;alert', '&#100;ata:text/html,test'])(
    'user cannot navigate to an entity-encoded unsafe scheme: %s',
    (href) => {
      // Given a forbidden scheme disguised with a character reference.
      const source = `[unsafe](${href})`
      // When the description renders the link.
      const container = document.createElement('div')
      container.innerHTML = renderToStaticMarkup(<TaskMarkdown source={source} />)
      // Then its label survives but no navigation is available.
      expect(container.textContent).toBe('unsafe')
      expect(container.querySelector('a')).toBeNull()
    },
  )

  it('user sees literal references inside code and escaped text', () => {
    // Given code examples and an escaped ampersand that must keep their spelling.
    const source = '`&amp; &#38;`\n\n```html\n&lt;div&gt; &amp;\n```\n\n\\&amp; &copy'
    // When the prompt and card summary are displayed.
    const container = document.createElement('div')
    container.innerHTML = renderToStaticMarkup(<TaskMarkdown source={source} />)
    // Then code, escaped references and references without semicolons stay literal.
    expect([...container.querySelectorAll('code')].map(code => code.textContent)).toEqual(['&amp; &#38;', '&lt;div&gt; &amp;'])
    expect(container.querySelector('p:last-child')?.textContent).toBe('&amp; &copy')
    expect(markdownToPlainText(source)).toBe('&amp; &#38; &lt;div&gt; &amp; &amp; &copy')
  })
})
