#!/usr/bin/env python3
"""
This script is used to scrape thread links from desuarchive.org. 

Usage: 
./desuthreads.py -p <number of pages> <base_url>
Example:
./desuthreads.py -p 5 https://desuarchive.org/mu/search/subject/%2Fbleep%2F/deleted/not-deleted
"""

import requests
from bs4 import BeautifulSoup
import argparse
import datetime

def scrape_thread_links(base_url, pages):
    all_links = []
    board_name = base_url.split('/')[3]  # Extracting board_name from base_url

    for page in range(1, pages+1):
        # Create URL for each page
        url = f"{base_url}/page/{page}/"

        # Send GET request
        response = requests.get(url)

        # If the GET request is successful, the status code will be 200
        if response.status_code == 200:
            # Get the content of the response
            page_content = response.content

            # Create a BeautifulSoup object and specify the parser
            soup = BeautifulSoup(page_content, 'html.parser')

            # Find all 'a' tags with the 'href' attribute containing '/{board_name}/thread/'
            thread_links = soup.find_all('a', href=lambda href: href and f"/{board_name}/thread/" in href)

            # Extract 'href' attributes and add them to the list
            for link in thread_links:
                cleaned_link = link.get('href').rsplit('/', 1)[0]  # Removing everything after the last /
                all_links.append(cleaned_link)

    # Remove duplicate links
    all_links = list(set(all_links))

    return all_links, board_name

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("base_url", help="the base URL from where to scrape the links")
    parser.add_argument("-p", "--pages", type=int, help="the number of pages to scrape", default=5)
    args = parser.parse_args()

    thread_links, board_name = scrape_thread_links(args.base_url, args.pages)

    # Constructing filename
    current_time = datetime.datetime.now().strftime("%y%m%d-%s")
    filename = f"threads-{board_name}-{current_time}.txt"

    # Write links to file
    with open(filename, 'w') as f:
        for link in thread_links:
            f.write(f"{link}\n")

if __name__ == "__main__":
    main()
