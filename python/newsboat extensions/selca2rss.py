#!/usr/bin/python
# selca2rss.py - Takes selca.kastden.org owner, group or hashtag url as first argument.
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

import sys
import random
import string
import requests
import json
from html import escape

url = 'https://selca.kastden.org/json/'

args = sys.argv[1].split('/')
type_ = args[3]
owner = args[4]

boundary = '----Boundary' \
    + ''.join(random.sample(string.ascii_letters + string.digits, 16))

headers = dict()
headers['content-type'] = 'multipart/form-data; boundary=' + boundary

data = """
Content-Disposition: form-data; name="page_type"\n
{0}
--{2}
Content-Disposition: form-data; name="{0}"\n
{1}
--{2}
Content-Disposition: form-data; name="limit"\n
100
--{2}
Content-Disposition: form-data; name="time_col"\n
added_at
--{2}
Content-Disposition: form-data; name="ephemeral"\n
yes
--{2}--
""".format(type_, owner, boundary)

resp = requests.post(url, headers=headers, data=data.encode('utf-8'))
data_dict = json.loads(resp.text)

# assemble dict of a list of entries with post_id as key
posts = dict()
for entries in data_dict['entries']:
    post_id = entries['post']['post_id']
    posts.setdefault(post_id, []).append(entries)

feed_description = feed_title = """{0} {1} Selca""".format(
    owner.capitalize(), type_.capitalize())
print("""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>{0}</title>
<description>{1}</description>
<link>https://selca.kastden.org/{2}/{3}/</link>
""".format(feed_title, feed_description, type_, owner))

for post_id in posts:
    entries = posts[post_id]
    text = entries[0]['post']['text']
    display_name = entries[0]['owner']['display_name']
    service = entries[0]['post']['service'].capitalize()
    if entries[0]['post']['ephemeral']:
        ephemeral = 'Story'
    else:
        ephemeral = 'Post'
    title = """{0} {1} {2}""".format(
            display_name, service, ephemeral)
    if text is None:
        text = ''
    else:
        title += ': ' + text.split('\n')[0]
    guid = link = 'https://selca.kastden.org/post/' + str(post_id)
    date = entries[0]['post']['created_at'].replace(' ', 'T')
    description = text
    added_at = entries[0]['post']['created_at']
    print("""
    <item>
    <title>{0}</title>
    <link>{1}</link>
    <guid>{2}</guid>
    <pubDate>{3}</pubDate>
    <description>{4}
    <![CDATA[
    <p>Added at: {5}</p>
    """.format(escape(title), link, guid, date, escape(description), added_at))

    for entry in entries:
        filename = entry['media']['filename']
        media_id = entry['media']['media_id']
        original = """https://selca.kastden.org/original/{0}/{1}""".format(
            media_id, filename)
        print('<img src="' + original + '"/>')

    print("""
    ]]>
    </description>
    </item>""")

print("""
</channel>
</rss>""")
