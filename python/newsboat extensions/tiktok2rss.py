#!/usr/bin/python
# tiktok2rss.py - Takes the desired username as first argument.
# Copyright (C) 2021  ysh <thinkingaboutshu@waifu.club>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

import json
import requests
import sys
from datetime import datetime
from lxml import html
from html import escape

user = sys.argv[1]
url = 'https://www.tiktok.com/@' + user
headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:60.0) Gecko/20100101 Firefox/81.0'}

page = requests.get(url, headers=headers)
tree = html.fromstring(page.text)
data_json = tree.xpath('//*[@id="SIGI_STATE"]/text()')[0]
data_dict = json.loads(data_json)

feed_description = feed_title = user + ' TikTok'
print("""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>{0}</title>
<description>{1}</description>
<link>{2}</link>""".format(feed_title, feed_description, url))

for tiktok_id in data_dict['ItemModule']:
    tiktok = data_dict['ItemModule'][str(tiktok_id)]
    title = tiktok['desc']
    if not title:
        title = 'New video from ' + user
    guid = link = 'https://www.tiktok.com/@' + user + '/video/' + tiktok_id
    date = datetime.fromtimestamp(int(tiktok['createTime'])).isoformat()
    description = tiktok['music']['title'] + ' - ' + \
        tiktok['music']['authorName']
    print("""
    <item>
    <title>{0}</title>
    <link>{1}</link>
    <guid>{2}</guid>
    <pubDate>{3}</pubDate>
    <description>{4}</description>
    </item>""".format(escape(title), link, guid, date, escape(description)))

print("""
</channel>
</rss>""")
