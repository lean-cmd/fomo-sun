const { Client } = require('@notionhq/client');

console.log("Starting script...");
console.log("Token length:", process.env.NOTION_TOKEN ? process.env.NOTION_TOKEN.length : 0);
console.log("DB ID length:", process.env.NOTION_BLOG_DB_ID ? process.env.NOTION_BLOG_DB_ID.length : 0);

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const blogDbId = process.env.NOTION_BLOG_DB_ID;

async function addBlogPost(title, markdownContent) {
    if (!blogDbId) {
        throw new Error('NOTION_BLOG_DB_ID environment variable is missing.');
    }

    const blocks = markdownContent.split('\n\n').filter(Boolean).map(text => ({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: text } }] }
    }));

    try {
        console.log("Sending request to Notion API...");
        const response = await notion.pages.create({
            parent: { database_id: blogDbId },
            properties: {
                Name: { title: [{ text: { content: title } }] },
                Slug: { rich_text: [{ text: { content: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') } }] },
                "Publish Date": { date: { start: new Date().toISOString().split('T')[0] } },
                "Show on Site": { checkbox: false },
                Status: { select: { name: "Draft" } }
            },
            children: blocks,
        });
        console.log(`Success! Blog post added: ${response.url}`);
        return response;
    } catch (error) {
        console.error('Error adding blog post:', error.body || error.message);
        throw error;
    }
}

const title = process.argv[2];
const content = process.argv[3];

if (!title || !content) {
    console.error('Usage: node add-notion-post.js "Post Title" "Post Content"');
    process.exit(1);
}

const timeout = setTimeout(() => {
    console.error("Script timed out after 10 seconds. Network might be blocking Notion or keys are invalid.");
    process.exit(1);
}, 10000);

addBlogPost(title, content)
    .then(() => clearTimeout(timeout))
    .catch(() => {
        clearTimeout(timeout);
        process.exit(1);
    });
