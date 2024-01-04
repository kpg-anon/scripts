import asyncio
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
import subprocess
import os
import re
import threading

"""
This script is used to download videos from sexkbj.com and sexbjcam.com.

Requirements:

• python
• playwright
• playwright-stealth
• firefox
• yt-dlp
• ffmpeg

Usage:

./kbj-dl.py [link1] [link2] [link3]
./kbj-dl.py -a links.txt
"""

async def fetch_m3u8_url(browser, url, prefix):
    print(f"{prefix}: Launching browser...")
    page = await browser.new_page()
    found_m3u8 = False
    m3u8_url = None

    async def handle_route(route):
        nonlocal found_m3u8, m3u8_url
        request = route.request
        request_url = request.url

        if found_m3u8:
            await route.abort()
        elif '.m3u8' in request_url:
            print('Found .m3u8 URL:', request_url)
            found_m3u8 = True
            m3u8_url = request_url

            output_filename_base = get_output_filename(url)
            output_filename = output_filename_base + '.mp4'
            output_dir = create_directory_and_get_path(output_filename_base)
            list_txt_path = os.path.join(output_dir, 'list.txt')
            with open(list_txt_path, 'w') as file:
                file.write(m3u8_url)

            print(f"Saving .m3u8 URL to {list_txt_path}")
            check_file_contents(list_txt_path)
            download_video(output_dir, output_filename)
            await route.abort()
        else:
            await route.continue_()

    await page.route("**/*", lambda route: asyncio.create_task(handle_route(route)))
    await stealth_async(page)

    try:
        print(f"{prefix}: Navigating to URL: {url}")
        await page.goto(url, wait_until='domcontentloaded')

        print('Extracting embed URL from iframe...')
        embed_url = await page.evaluate('''() => {
            const iframe = document.querySelector('.responsive-player iframe');
            return iframe ? iframe.src : null;
        }''')

        if not embed_url:
            print('Embed URL not found')
            await page.close()
            return None

        print('Navigating to embed URL:', embed_url)
        await page.goto(embed_url, wait_until='domcontentloaded')

        while not found_m3u8:
            await asyncio.sleep(0.1)

    except Exception as e:
        print(f"Error during browser navigation: {e}")

    finally:
        await page.close()
        return m3u8_url

def create_directory_and_get_path(dir_name):
    output_dir = os.path.join(os.getcwd(), dir_name)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    return output_dir

def get_output_filename(url):
    url = url.strip()
    regex = re.compile(r'.*_(\w+_\d+)/?$')
    match = regex.search(url)
    return match.group(1) if match else 'default_output'

def check_file_contents(file_path):
    if os.path.exists(file_path):
        print(f"File {file_path} exists. Contents:")
        with open(file_path, 'r') as file:
            print(file.read())
    else:
        print(f"File {file_path} does not exist.")

def print_output(stream):
    for line in iter(stream.readline, ''):
        print(line, end='')

def download_video(output_dir, output_filename):
    list_txt_path = os.path.join(output_dir, 'list.txt')
    command = ['yt-dlp', '-o', output_filename, '-a', list_txt_path, '--downloader', 'ffmpeg']
    print(f"Executing command: {' '.join(command)} in directory: {output_dir}")
    check_file_contents(list_txt_path)

    with subprocess.Popen(command, cwd=output_dir, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True) as process:
        for line in iter(process.stdout.readline, ''):
            print(line, end='')

    if process.returncode != 0:
        print(f"yt-dlp exited with code {process.returncode}")
    
    try:
        os.remove(list_txt_path)
    except OSError as e:
        print(f"Error deleting list.txt file: {e}")

async def process_urls(urls):
    async with async_playwright() as p:
        browser = await p.firefox.launch(headless=True)
        for i, url in enumerate(urls):
            prefix = f"Download {i + 1}/{len(urls)}"
            print(f"{prefix}: Processing {url}")

            try:
                await fetch_m3u8_url(browser, url, prefix)
                print(f"{prefix}: Download complete.")
            except Exception as e:
                print(f"{prefix}: Error processing {url}: {e}")
        await browser.close()
    print("All downloads complete.")

def main():
    import sys
    args = sys.argv[1:]

    if not args:
        print("Please provide URLs or a file containing URLs.")
        sys.exit(1)

    urls = []
    if args[0] == '-a' and len(args) == 2:
        with open(args[1], 'r') as file:
            urls = [line.strip() for line in file if line.strip()]
    else:
        urls = args

    asyncio.run(process_urls(urls))

if __name__ == "__main__":
    main()
