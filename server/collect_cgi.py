#!/usr/bin/env python
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

from webob.dec import wsgify
import MySQLdb
from pyfomatic import collect
from graphsdb import db


@wsgify
def application(req):
    collect.handleRequest(req, db, MySQLdb)
