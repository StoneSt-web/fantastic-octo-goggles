"""用 Playwright 渲染 preview.html 并截图"""
import asyncio
from playwright.async_api import async_playwright

HTML_PATH = r'file:///F:/MinMax Code/0629/desktop-pet/skins/死神倔强卜/preview.html'
OUT = r'F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\preview-screenshot.png'

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 425, 'height': 204})
        await page.goto(HTML_PATH)
        await page.wait_for_load_state('networkidle')
        # 给 PNG 时间加载
        await page.wait_for_timeout(800)
        await page.screenshot(path=OUT, full_page=False)
        print(f'screenshot saved: {OUT}')
        await browser.close()

asyncio.run(main())