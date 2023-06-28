#!/usr/bin/env python3
"""
This script generates an RSS feed from a kastden filter page 
"""

from flask import Flask, Response
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from email.utils import formatdate
import PyRSS2Gen

app = Flask(__name__)

@app.route('/')
def generate_feed():
    url = 'https://selca.kastden.org/filter/kpganon/'
    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')

    entries = soup.find_all('div', class_='entry')

    # Limit to the 30 most recent entries
    entries = entries[:30]

    rss_items = []
    for entry in entries:
        text_div = entry.find('div', class_='text linkification_pending')
        title = ''.join(text_div.stripped_strings) if text_div and text_div.stripped_strings else None
        description = entry.find('a', class_='external_post_link')['href']
        link = 'https://selca.kastden.org' + entry.find('a')['href']

        # Add pubDate and author fields
        created_at = entry.get('data-created_at')
        pubDate = datetime.strptime(created_at, '%Y-%m-%d %H:%M:%S') if created_at else None
        author = entry.find('div', class_='metadata').find('a', class_='user owner_link').text

        rss_items.append(PyRSS2Gen.RSSItem(
            title=title,
            link=link,
            description=description,
            pubDate=pubDate,
            author=author
        ))

    rss = PyRSS2Gen.RSS2(
        title='KPGAnon RSS Feed',
        link='http://127.0.0.1:8080/',
        description='An RSS feed for Kastden',
        lastBuildDate=datetime.now(),
        items=rss_items
    )

    response = Response(rss.to_xml(encoding='utf-8'))
    response.headers.set('Content-Type', 'application/rss+xml')

    return response

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8080)
