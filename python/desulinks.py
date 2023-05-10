#!/usr/bin/env python3
'''
This script scrapes a desuarchive.org thread for YouTube links and saves them to a .m3u playlist file.

Usage: ./desulinks.py <thread_url>

To scrape multiple threads run the following command on the output text file from desuthreads.py:
while IFS= read -r line; do ./desulinks.py "$line"; done < threads.txt

You can then concat them to a single playlist like so:
cat *.m3u | uniq >> list.m3u
'''

import re
import argparse
import datetime
import os
import requests
from bs4 import BeautifulSoup


def main():
    parser = argparse.ArgumentParser(description='Scrape a thread for YouTube links and save them to a .m3u playlist file')
    parser.add_argument('url', help='Thread URL')
    args = parser.parse_args()

    # Extract board name and thread number from URL
    match_desuarchive = re.match(r'https?://(www\.)?desuarchive\.org/[a-z]+/thread/\d+', args.url)

    if match_desuarchive:
        domain = 'desuarchive.org'
        parts = args.url.split('/')
        if len(parts) >= 5:
            board = parts[3]
            thread_num = parts[5]
        else:
            print('Invalid thread URL')
            return

    # Fetch thread HTML and extract YouTube links
    response = requests.get(args.url)
    soup = BeautifulSoup(response.text, 'html.parser')
    youtube_links = [
        link['href'] for link in soup.find_all('a', {'href': re.compile(r'https?://(www\.)?(youtube\.com|youtu\.be)/watch\?v=')})
    ]

    # Generate playlist filename based on current date, board name, thread number, and time
    dt = datetime.datetime.now().strftime('%Y-%m-%d-%H_%M_%S')
    filename = f'{dt}-{board}-{thread_num}.m3u'

    # Write links to playlist file
    with open(filename, 'w') as f:
        for link in youtube_links:
            f.write(f'{link}\n')

    print(f'Saved {len(youtube_links)} YouTube links to {filename}')

if __name__ == '__main__':
    main()
