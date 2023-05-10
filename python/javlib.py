#!/usr/bin/env python3

"""
Scrape JAVLibrary information using the javscraper module

Usage:
    ./javlib.py <code>
    ./javlib.py list.txt
"""

import argparse
from datetime import datetime
from javscraper import JAVLibrary

# Format JAVResult information
def format_jav_result(jav_result):
    release_date = getattr(jav_result, 'release_date', None)
    code = getattr(jav_result, 'code', None)
    actresses = getattr(jav_result, 'actresses', None)
    release_date_str = release_date.strftime('%Y-%m-%d') if release_date else 'N/A'
    code_str = code if code else 'N/A'
    actresses_str = ', '.join(actresses) if actresses else 'N/A'
    return f"{release_date_str} {code_str} - {actresses_str}"

# Parse command-line arguments
parser = argparse.ArgumentParser()
parser.add_argument('search_string', help='JAVLibrary search string or filename')
args = parser.parse_args()

# Create JAVLibrary instance
javlibrary = JAVLibrary()

# Process search strings
search_strings = []

if args.search_string.endswith('.txt'):
    with open(args.search_string) as f:
        search_strings = [line.strip() for line in f.readlines()]
else:
    search_strings.append(args.search_string)

# Perform searches and print results
for search_string in search_strings:
    result = javlibrary.get_video(search_string)
    if isinstance(result, str):
        print(result)  # Print error message if result is a string
    elif result:
        print(format_jav_result(result))
    else:
        print(f"No information found for {search_string}")
