#!/usr/bin/python
# gfycat2rss.py - Takes a gfycat username as argument
# Copyright (C) 2022  ysh <thinkingaboutshu@waifu.club>
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

import sys
import requests
import json
from html import escape
from datetime import datetime

user = sys.argv[1]
url = "https://api.gfycat.com/v1/users/" + user + "/gfycats?count=30"

resp = requests.get(url)

data = json.loads(resp.text)
gfys = data['gfycats']

feed_title = gfys[0]['username'] + " gfycat"
feed_description = gfys[0]['userDisplayName']
print("""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>{0}</title>
<description>{1}</description>
<link>https://gfycat.com/@{2}</link>"""
    .format(feed_title, feed_description, user))

for gfy in gfys:
    title = gfy['title']
    link = "https://gfycat.com/" + gfy['gfyName']
    date = datetime.fromtimestamp(int(gfy['createDate'])).isoformat()
    description = "Tags: " + gfy['description'] + ', '.join(gfy['tags'])
    mini = gfy['mobileUrl']

    print("""
    <item>
    <title>{0}</title>
    <link>{1}</link>
    <pubDate>{2}</pubDate>
    <description>{3}
    <![CDATA[<iframe src="{4}"></iframe>]]>
    </description>
    </item>"""
        .format(escape(title), link, date, escape(description), mini))

print("""
</channel>
</rss>""")
