---
description: How to sync Notion pages using the fomo-sun workspace CMS integration
---

# Syncing Notion Pages

Antigravity and other agents can create and manage basic text posts on FOMO Sun through Notion manually or by using the created node script `scripts/add-notion-post.js`.

### Environment Variables

Before using Notion as a Headless CMS, the environment requires these values. These are configured in Vercel for production but need to be accessible to scripts:

- `NOTION_TOKEN` - The Notion Internal Integration Token
- `NOTION_BLOG_DB_ID` - The Notion Database ID for Blog Posts 
- `NOTION_ABOUT_PAGE_ID` - The Notion Page ID for the About page

### Creating a New Blog Post

Create a new blog post simply by providing the title and content blocks as arguments:

```bash
node scripts/add-notion-post.js "New Post Title" "Paragraph content 1\n\nParagraph content 2"
```

The script will automatically detect the database and append standard properties such as Slug and Date. Markdown is minimally supported.

### Manual API Usage

For more complex structures, you may want to parse markdown into Notion's Block JSON format manually and use `@notionhq/client` to execute `notion.pages.create()`.

See Notion API documentation: https://developers.notion.com/
