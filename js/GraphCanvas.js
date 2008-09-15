/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is new-graph code.
 *
 * The Initial Developer of the Original Code is
 *    Mozilla Corporation
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Vladimir Vukicevic <vladimir@pobox.com> (Original Author)
 *   Alice Nodelman <anodelman@mozilla.com>
 *   Jeremiah Orem <oremj@oremj.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var ONE_MINUTE_SECONDS = 60;
var ONE_HOUR_SECONDS = 60*ONE_MINUTE_SECONDS;
var ONE_DAY_SECONDS = 24*ONE_HOUR_SECONDS;
var ONE_WEEK_SECONDS = 7*ONE_DAY_SECONDS;
var ONE_YEAR_SECONDS = 365*ONE_DAY_SECONDS; // leap years whatever.

var MONTH_ABBREV = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];

function Graph() {
}

Graph.prototype = {
    eventTarget: null,

    startTime: null,
    endTime: null,
    offsetTime: 0,
    //this offsetTime is used in DiscreteGraphs to draw bar graphs
    zoomed: false,
    
    borderTop: 1,
    borderLeft: 1,

    yScale: 1,
    yOffset: 0,

    backBuffer: null,
    frontBuffer: null,
    yAxisDiv: null,
    xAxisDiv: null,

    dataSets: null,
    dataSetIndices: null,
    dataSetMinMaxes: null,

    dataSetMinMinVal: 0,
    dataSetMaxMaxVal: 0,

    xLabelContainer: null,
    xLabelWidth: 75,
    xLabelHeight: 50,

    yLabelContainer: null,
    yLabelWidth: 50,
    yLabelHeight: 50,

    // should the Y axis be autoscaled (true),
    // or always start at 0 (false)
    autoScaleYAxis: true,

    scaleLabelIntervals: [ 1, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000 ],
    timeLabelIntervals: [ 1, 30, ONE_MINUTE_SECONDS, 2*ONE_MINUTE_SECONDS, 5*ONE_MINUTE_SECONDS,
                          10*ONE_MINUTE_SECONDS, 15*ONE_MINUTE_SECONDS, 30*ONE_MINUTE_SECONDS,
                          ONE_HOUR_SECONDS, 2*ONE_HOUR_SECONDS, 3*ONE_HOUR_SECONDS,
                          6*ONE_HOUR_SECONDS, 12*ONE_HOUR_SECONDS,
                          ONE_DAY_SECONDS, 2*ONE_DAY_SECONDS,
                          ONE_WEEK_SECONDS, 2*ONE_WEEK_SECONDS, 4*ONE_WEEK_SECONDS,
                          8*ONE_WEEK_SECONDS, 16*ONE_WEEK_SECONDS, 32*ONE_WEEK_SECONDS,
                          ONE_YEAR_SECONDS ],

    //
    // Selection configuration
    //

    // default selection type; 'none', 'range', 'cursor'
    // used if the user does a mousedown without modifier keys
    defaultSelectionType: "none",
    // selection color
    selectionColor: "rgba(0,0,255,0.5)",

    // holds the details of the current selection
    selectionType: null,
    selectionCursorTime: null,
    selectionStartTime: null,
    selectionEndTime: null,

    //
    // Cursor configuration
    //

    // cursor type; 'none', 'free', 'snap'
    cursorType: "none",
    // the color the cursor should be drawn in
    cursorColor: "rgba(200,200,0,0.7)",
    // holds the cursor time/value
    cursorTime: null,
    cursorValue: null,

    // whether points should be drawn on the graph
    drawPoints: false,
    // radius (in pixels) of the points
    pointRadius: 1.5,

    markerColor: "rgba(200,0,0,0.4)",
    markersVisible: true,
    markers: null,

    dirty: true,
    valid: false,

    init: function (canvasElement) {
        this.frontBuffer = $("#" + canvasElement)[0];
        this.xLabelContainer = $("#" + canvasElement + "-labels-x")[0];
        this.yLabelContainer = $("#" + canvasElement + "-labels-y")[0];

        this.backBuffer = document.createElement("canvas");
        this.backBuffer.width = this.frontBuffer.width;
        this.backBuffer.height = this.frontBuffer.height;

        this.overlayBuffer = document.createElement("canvas");
        this.overlayBuffer.width = this.frontBuffer.width;
        this.overlayBuffer.height = this.frontBuffer.height;

        this.dataSets = new Array();
        this.dataSetMinMaxes = new Array();
        this.dataSetIndices = new Array();

        this.markers = new Array();

        this.eventTarget = this.frontBuffer;

        var self = this;

        // we have to bind these as capturing events, otherwise I don't get the events;
        // not sure why.  jQuery doesn't support capture phase events (due to cross-browser
        // compat), so we use the DOM here.

        this.removeEventList (this.frontBuffer, "selection");

        this.addEventList (this.frontBuffer, "selection",
                           [ "mousedown", function (event) { return self.selectionMouseDown(event); },
                             "mousemove", function (event) { return self.selectionMouseMove(event); },
                             "mouseup", function (event) { return self.selectionMouseUp(event); },
                             "mouseout", function (event) { return self.selectionMouseOut(event); } ] );

        //log(this.offsetTime + " offsetTime");
    },

    getQueryString: function (prefix) {
        var qs = "";

        qs += prefix + "st=" + this.selectionType;
        if (this.selectionType == "range") {
            if (this.selectionStartTime != null && this.selectionEndTime != null)
                qs += "&" + prefix + "ss=" + this.selectionStartTime + "&" + prefix + "se=" + this.selectionEndTime;
        } else if (this.selectionType == "cursor") {
            if (this.selectionCursorTime != null)
                qs += "&" + prefix + "sc=" + this.selectionCursorTime;
        }

        qs += "&" + prefix + "start=" + this.startTime + "&" + prefix + "end=" + this.endTime;
        log ("getQueryString", qs);

        return qs;
    },

    handleQueryStringData: function (prefix, qsdata) {
        // XX should do some more verification that
        // qsdata has the members we care about
        this.startTime = new Number(qsdata[prefix + "start"]);
        this.endTime = new Number(qsdata[prefix + "end"]);

        var st = qsdata[prefix + "st"];
        if (st == "range") {
            this.selectionType = "range";
            if (((prefix+"ss") in qsdata) && ((prefix+"se") in qsdata)) {
                this.selectionStartTime = new Number(qsdata[prefix + "ss"]);
                this.selectionEndTime = new Number(qsdata[prefix + "se"]);
            } else {
                this.selectionStartTime = null;
                this.selectionEndTime = null;
            }                
        } else if (st == "cursor") {
            this.selectionType = "Cursor";
            if ((prefix+"sc") in qsdata)
                this.selectionCursorTime = new Number(qsdata[prefix + "sc"]);
            else
                this.selectionCursorTime = null;
        }

        this.dirty = true;
    },

    addDataSet: function (ds, color) {
        if (this.dataSets.some(function(d) { return (d==ds); }))
            return;

        if (color == null) {
            if (ds.color != null) {
                color = ds.color;
            } else {
                color = randomColor();
            }
        }

        this.dataSets.push(ds);
        this.dataSetIndices.push(null);
        this.dataSetMinMaxes.push(null);

        this.dirty = true;
    },

    removeDataSet: function (ds) {
        for (var i = 0; i < this.dataSets.length; i++) {
            if (this.dataSets[i] == ds) {
                Array.splice(this.dataSets, i, 1);
                Array.splice(this.dataSetIndices, i, 1);
                Array.splice(this.dataSetMinMaxes, i, 1);
            }
        }

        
        
        if(this.dataSets.length == 0) {
            this.selectionType = null;
            this.selectionStartTime = null;
            this.selectionEndTime = null;
        }
        
        this.autoScale();
        this.redraw();
        this.dirty = true;
        if(!this.zoomed || this.dataSets.length == 0) {
           this.resetEndTime(); 
        }
        
    },
    
    resetEndTime: function() {
        var endTime = 0;
        
        for each (var dataset in this.dataSets) {
            if(dataset.lastTime > endTime) {
                endTime = dataset.lastTime;
            }
        }
        
        if(endTime == 0) {
            endTime = null;
        }
        
        this.setTimeRange(0, endTime, true);
    },

    clearDataSets: function () {
        this.zoomed = false;
        this.dataSets = new Array();
        this.dataSetMinMaxes = new Array();
        this.dataSetIndices = new Array();

        this.dirty = true;
    },

    setTimeRange: function (start, end, reset) {
        if(!reset) {
            this.zoomed = true;
        }
        
        this.startTime = start;
        this.endTime = end;
        
        this.dirty = true;
    },

    expandTimeRange: function (start, end) {
        if (this.startTime == null || start < this.startTime)
            this.startTime = start;
        if (this.endTime == null || end > this.endTime)
            this.endTime = end;

        this.dirty = true;
    },

    getSelection: function () {
        if (this.selectionType == "range")
            return { type: "range", start: this.selectionStartTime, end: this.selectionEndTime };
        if (this.selectionType == "cursor")
            return { type: "cursor", value: this.selectionCursorTime };
        return { type: "none" };
    },

    setDefaultSelectionType: function (stype) {
        if (this.defaultSelectionType == stype)
            return;

        if (stype != "none" && stype != "range" && stype != "cursor")
            return;

        this.defaultSelectionType = stype;
    },

    setSelectionColor: function (scolor) {
        this.selectionColor = scolor;
        this.redrawOverlayOnly();
    },
    
    resize: function () {
        this.backBuffer.width = this.frontBuffer.width;
        this.backBuffer.height = this.frontBuffer.height;
        /* Always have at least 6 labels on the graph */
        if (this.frontBuffer.height < 300) {
            this.yLabelHeight = this.frontBuffer.height / 6;
        }
        if (this.frontBuffer.width < 900) {
            this.xLabelWidth = this.frontBuffer.width / 6;
        }
        this.overlayBuffer.width = this.frontBuffer.width;
        this.overlayBuffer.height = this.frontBuffer.height;
        this.dirty = true;
        this.autoScale();
        this.redraw();
    },

    setCursorType: function (type) {
        if (this.cursorType == type)
            return;

        var self = this;

        // we have to bind these as capturing events, otherwise I don't get the events;
        // not sure why.  jQuery doesn't support capture phase events (due to cross-browser
        // compat), so we use the DOM here.

        this.removeEventList (this.frontBuffer, "cursor");

        if (type == "free" || type == "snap") {
            this.addEventList (this.frontBuffer, "cursor",
                               [ "mousemove", function (event) { self.cursorMouseMove(event); },
                                 "mouseout", function (event) { self.cursorMouseOut(event); } ]);
            this.cursorType = type;
        } else {
            this.cursorType = "none";
        }
    },

    recompute: function () {
        this.dataSetIndices = [];
        this.dataSetMinMaxes = [];

        this.hasRelative = false;
        var nonRelative = 0;

        for (var i = 0; i < this.dataSets.length; i++) {
            this.dataSetIndices.push (this.dataSets[i].indicesForTimeRange (this.startTime, this.endTime));
            this.dataSetMinMaxes.push (this.dataSets[i].minMaxValueForTimeRange (this.startTime, this.endTime));

            if (this.dataSets[i].relativeTo != null)
                this.hasRelative = true;
            else
                nonRelative++;
        }

        if (this.hasRelative && nonRelative > 1) {
            log("More than one non-relative dataset added to graph");
            throw "More than one non-relative dataset added to graph";
        }

        this.dataSetMinMinVal = Number.MAX_VALUE;
        this.dataSetMaxMaxVal = Number.MIN_VALUE;


        for each (var dsvals in this.dataSetMinMaxes) {
            if (dsvals[0] != Infinity && dsvals[1] != -Infinity) {
                if (this.dataSetMinMinVal > dsvals[0])
                    this.dataSetMinMinVal = dsvals[0];
                if (this.dataSetMaxMaxVal < dsvals[1])
                    this.dataSetMaxMaxVal = dsvals[1];
            }
        }

        if (this.dataSetMinMinVal == Number.MAX_VALUE &&
            this.dataSetMaxMaxVal == Number.MIN_VALUE)
        {
            this.dataSetMinMinVal = 0;
            this.dataSetMaxMaxVal = 100;
        }

        this.getTimeAxisLabels();
        this.getValueAxisLabels();

        this.dirty = false;
    },

    autoScale: function () {
        if (this.dirty)
            this.recompute();

        var vmin, vmax;

        if (!this.autoScaleYAxis) {
            vmin = 0.0;
            if (this.dataSetMinMinVal < 0)
                vmin = this.dataSetMinMinVal;
            this.yOffset = vmin;
            this.yScale = (this.frontBuffer.height-10) / Math.ceil(this.dataSetMaxMaxVal - vmin);
            this.dirty = true;
            return;
        }

        if (this.hasRelative) {
            vmin = Math.floor(this.dataSetMinMinVal);
            vmax = Math.ceil(this.dataSetMaxMaxVal);

            if ((vmax - vmin) == 1)
                vmin--;

            //log ("vmin", vmin, "vmax", vmax);
            this.yOffset = vmin;
            this.yScale = this.frontBuffer.height / (vmax - vmin);
            this.dirty = true;

            return;
        }

        var delta = this.dataSetMaxMaxVal - this.dataSetMinMinVal;
        if (delta == 0) {
            this.yOffset = this.dataSetMinMinVal - (this.frontBuffer.height)/2;
            this.yScale = 1;
            scaled = true;
        } else {
            var scaled = false;
            for each (var sfactor in [100, 25, 10, 1]) {
                if (delta > sfactor) {
                    if (this.dataSetMinMinVal < 0)
                        vmin = this.dataSetMinMinVal - (sfactor - Math.abs(this.dataSetMinMinVal) % sfactor);
                    else
                        vmin = this.dataSetMinMinVal - (Math.abs(this.dataSetMinMinVal) % sfactor);
                    vmax = (this.dataSetMaxMaxVal - (this.dataSetMaxMaxVal % sfactor)) + sfactor;

                    this.yOffset = vmin;
                    this.yScale = this.frontBuffer.height / (vmax - vmin);
                    scaled = true;
                    break;
                }
            }
        }

        if (!scaled) {
            this.yOffset = this.dataSetMinMinVal;
            this.yScale = this.frontBuffer.height / (this.dataSetMaxMaxVal - this.dataSetMinMinVal);
        }

        //log ("autoScale: yscale:", this.yScale, "yoff:", this.yOffset);
        // we have to dirty again, due to the labels
        this.dirty = true;
    },

    clearGraph: function() {
        var ctx = this.frontBuffer.getContext("2d");
        var cw = this.frontBuffer.width;
        var ch = this.frontBuffer.height;
        with (ctx) {
            fillStyle = "#FFFFFF";
            fillRect (0, 0, cw, ch);
        }
        replaceChildNodes(this.xLabelContainer, null);
        replaceChildNodes(this.yLabelContainer, null);
    },

    redraw: function () {
        if (this.dirty)
            this.recompute();

        var ctx = this.backBuffer.getContext("2d");
        var cw = this.backBuffer.width;
        var ch = this.backBuffer.height;

        var xoffs = this.startTime;
        var yoffs = this.yOffset;

        var xscale = cw / (this.endTime - this.startTime + this.offsetTime);

        if (this.endTime == this.startTime) {
            // we have just one point
            xoffs -= cw / 2;
            xscale = 1.0;
        }

        var hasDerivedDSs = false;
        for each (var ds in this.dataSets) {
            if ("averageOf" in ds || "derivativeOf" in ds) {
                hasDerivedDSs = true;
                break;
            }
        }

        if (this.dataSets.length == 0) {
            ctx.clearRect (0, 0, cw, ch);
            this.redrawOverlayOnly();
            $(this.eventTarget).trigger("graphNewGraph", [ this.dataSets ]);

            this.makeLabels();
            this.valid = true;
            return;
        }

        // yScale = pixels-per-value
        //log("this.startTime: " + this.startTime);
        //log("this.endTime: " + this.endTime);
        with (ctx) {
            clearRect (0, 0, cw, ch);
            lineWidth = 1.0;

            // draw gridlines
            var timeLabelValues = this.getTimeAxisLabels();
            strokeStyle = "#999999";
            for each (var label in timeLabelValues) {
                // label[1] is the actual value of that label line; we need
                // to scale it into place, but we can't just use scale()
                // since we want to make sure it's a single-pixel line
                var p = Math.round((label[1] - xoffs) * xscale) + 0.5;
                beginPath();
                moveTo(p, -0.5);
                lineTo(p, ch + 0.5);
                stroke();
            }

            var valueLabelValues = this.getValueAxisLabels();
            for each (var label in valueLabelValues) {
                var p = Math.round((label[1] - yoffs) * this.yScale) + 0.5;
                beginPath();
                moveTo(-0.5, ch - p);
                lineTo(this.frontBuffer.width + 0.5, ch - p);
                stroke();
            }

            // draw markers
            strokeStyle = this.markerColor;
            for (var i = 0; i < this.markers.length/2; i++) {
                var mtime = this.markers[i*2];
                //var mlabel = this.markers[i*2+1];

                if (mtime < this.startTime || mtime > this.endTime)
                    continue;

                var p = Math.round((mtime - xoffs) * xscale) + 0.5;
                beginPath();
                moveTo(p, Math.round(this.frontBuffer.height*0.8)-0.5);
                lineTo(p, this.frontBuffer.height+0.5);
                stroke();
            }
        }

        // draw actual graph lines

        // if offsetTime is 0, draw a normal graph
        if (this.offsetTime == 0) {
            for (var i = 0; i < this.dataSets.length; i++) {
                if (this.dataSetIndices[i] == null) {
                    // there isn't anything in the data set in the given time range
                    continue;
                }

                var dsHasDerived = false;
                if (hasDerivedDSs) {
                    // figure out if there is a derived set for this ds being drawn
                    for each (var ds in this.dataSets) {
                        if (("averageOf" in ds && ds.averageOf == this.dataSets[i]) ||
                            ("derivativeOf" in ds && ds.derivativeOf == this.dataSets[i]))
                        {
                            dsHasDerived = true;
                            break;
                        }
                    }
                }

                with (ctx) {
                    // draw any baselines.  needs to be rethought
                    for (baseline in this.dataSets[i].baselines) {
                        save();
                        var v = ch - Math.round((this.dataSets[i].baselines[baseline] - yoffs) * this.yScale);
                        var x0 = Math.round((this.startTime - xoffs) * xscale);
                        var x1 = Math.round((this.endTime - xoffs) * xscale);
                        beginPath();
                        moveTo(x0-0.5, v+0.5);
                        lineTo(x1+0.5, v+0.5);
                        strokeStyle = colorToRgbString(this.dataSets[i].color);
                        globalAlpha = 0.2;
                        lineWidth = 5.0;
                        stroke();
                        restore();
                        strokeStyle = colorToRgbString(this.dataSets[i].color);
                        lineWidth = 1.0;
                        stroke();
                    }

                    //log ("ds start end", this.startTime, this.endTime, "timediff:", (this.endTime - this.startTime + this.offsetTime));
                    var startIdx = this.dataSetIndices[i][0];
                    var endIdx = this.dataSetIndices[i][1];

                    // start one before and go one after if we can,
                    // so that the plot doesn't have a hole at the start
                    // and end
                    if (startIdx > 0) startIdx--;
                    if (endIdx < ((this.dataSets[i].data.length)/2)) endIdx++;

                    save();
                    scale(xscale, -this.yScale);
                    translate(0, -ch/this.yScale);

                    beginPath();

                    for (var j = startIdx; j < endIdx; j++)
                    {
                        var t = this.dataSets[i].data[j*2];
                        var v = this.dataSets[i].data[j*2+1];

                        lineTo(t-xoffs, v-yoffs);
                    }

                    // restore before calling stroke() so that we can
                    // do a line width in absolute pixel size
                    restore();

                    if (dsHasDerived) {
                        lineWidth = 0.5;
                    } else {
                        lineWidth = 1.0;
                    }

                    strokeStyle = colorToRgbString(this.dataSets[i].color);
                    stroke();

                    // only draw points for non-average datasets (and
                    // only if points are set).  Also only draw points
                    // if they'd be visible -- that is if the display
                    // width is greater than the number of points to
                    // be drawn * 2 * pointRadius
                    var shouldMaybeDrawPoints = true;
                    if (endIdx != startIdx && ((endIdx - startIdx) * 2 * this.pointRadius > cw))
                        shouldMaybeDrawPoints = false;

                    // points get drawn for delta derivatives, just not averages
                    if (shouldMaybeDrawPoints &&
                        this.drawPoints &&
                        !("averageOf" in this.dataSets[i]))
                    {
                        save();

                        // if this ds has a derived set, make these fainter
                        if (dsHasDerived)
                            globalAlpha = 0.3;

                        fillStyle = colorToRgbString(this.dataSets[i].color);

                        for (var j = startIdx; j < endIdx; j++)
                        {
                            var t = this.dataSets[i].data[j*2];
                            var v = this.dataSets[i].data[j*2+1];

                            beginPath();
                            arc((t-xoffs) * xscale, ((v-yoffs) + (-ch/this.yScale)) * -this.yScale,
                                this.pointRadius, 0, Math.PI * 2.0, false);
                            fill();
                        }

                        globalAlpha = 1.0;
                        restore();
                    }
                }
            }
        } else {
            // we're doing a bar graph, and we don't have to
            // worry about any average stuff.

            // we assume that each "time" index is offset by offsetTime.
            // XXX we really should just specify "graph has a constant spacing"
            // as opposed to an explicit "offsetTime", and let the graph
            // figure out how best to draw that in the available space

            // Note that we can't round this, but we do round when
            // we draw the line coordinates, to get solid vertical lines.
            // However, that means that as the graph goes along, the width
            // of each "bar" will vary by as much as 1 pixel -- I think that's
            // ok, ebcause in practice it's not noticable, and it's much less
            // distracting than blurry edges.
            var scaledOffset = this.offsetTime * xscale;

            // these better be the same for each dataset, but we'll clamp
            // them
            var startIdx = this.dataSetIndices[0][0];
            var endIdx = this.dataSetIndices[0][1];
            
            for (var i = 0; i < this.dataSetIndices.length; i++) {
                if(this.dataSetIndices[i][1] > endIdx) {
                    endIdx = this.dataSetIndices[i][1];
                }
            }
            

            // the fill styles we'll use for each graph
            var fillStyles = [];

            for (var i = 0; i < this.dataSets.length; i++) {
                fillStyles.push(colorToRgbString(this.dataSets[i].color));
            }

            with (ctx) {
                save();

                // we do the scaling/etc. manually, so that we can control pixel position
                // of the lines

                // always start at 0
                var zeroY = (- yoffs) * (- this.yScale) + ch;
                var lastT = (this.dataSets[0].data[startIdx*2] - xoffs) * xscale;

                if (0) {
                    var grad = createLinearGradient(0.0, zeroY / 2.0, 0.0, zeroY);
                    grad.addColorStop(0.0, colorToRgbString(this.dataSets[i].color/*, 1.0 / this.dataSets.length*/));
                    grad.addColorStop(1.0, "rgba(255,255,255,0.0)");
                }

                for (var j = startIdx; j < endIdx; j++)
                {
                    var values = [];

                    for (var i = 0; i < this.dataSets.length; i++) {
                        // don't care about t -- we're always going to draw steps
                        // exactly scaledOffset apart
                        var v = this.dataSets[i].data[j*2+1] - yoffs;
                        v = v * (- this.yScale) + ch;
                        values.push([i, v]);
                    }

                    values.sort(function(a,b) {
                                    if (a[1] < b[1]) return -1;
                                    if (a[1] > b[1]) return 1;
                                    return 0;
                                });

                    for (var i = 0; i < values.length; i++) {
                        var v = values[i][1];
                        if(v) {
                            beginPath();
                            moveTo(Math.round(lastT) + 0.25, zeroY);
                            lineTo(Math.round(lastT) + 0.25, v);
                            lineTo(Math.round(lastT + scaledOffset) - 0.25, v);
                            lineTo(Math.round(lastT + scaledOffset) - 0.25, zeroY);
                            closePath();

                            fillStyle = fillStyles[values[i][0]];
                            fill(); 
                        }
                        
                    }

                    lastT += scaledOffset;
                }

                restore();
            }
        }

        this.redrawOverlayOnly();

        $(this.eventTarget).trigger("graphNewGraph", [ this.dataSets ]);

        this.makeLabels();
        this.valid = true;
    },

    redrawOverlayOnly: function () {
        with (this.frontBuffer.getContext("2d")) {
            globalCompositeOperation = "copy";
            drawImage(this.backBuffer, 0, 0);
        }

        // if we don't have anything to graph, just give up
        if (this.startTime == this.endTime)
            return;

        var doDrawOverlay = false;

        with (this.overlayBuffer.getContext("2d")) {
            /* Draw selection, if any */
            clearRect(0, 0, this.overlayBuffer.width, this.overlayBuffer.height);
            if (this.selectionType == "cursor" || this.selectionType == "range") {
                var spixel, epixel;
                var pps = (this.frontBuffer.width / (this.endTime - this.startTime + this.offsetTime));
                var draw = false;

                if (this.selectionType == "cursor" && this.selectionCursorTime) {
                    spixel = Math.round((this.selectionCursorTime-this.startTime) * pps);
                    epixel = spixel + 1;
                    draw = true;
                } else if (this.selectionType == "range" && this.selectionStartTime && this.selectionEndTime) {
                    spixel = Math.round((this.selectionStartTime-this.startTime) * pps);
                    epixel = Math.round((this.selectionEndTime-this.startTime) * pps);
                    draw = true;
                }

                if (draw) {
                    globalCompositeOperation = "over";
                    fillStyle = this.selectionColor;
                    fillRect(spixel, 0, epixel - spixel, this.frontBuffer.height);

                    doDrawOverlay = true;
                }
            }

            /* Draw cursor, if any */
            if ((this.cursorType != "none") && this.cursorTime != null && this.cursorValue != null) {
                globalCompositeOperation = "over";
                strokeStyle = this.cursorColor;

                var cw = this.frontBuffer.width;
                var ch = this.frontBuffer.height;

                var v;

                v = ch - Math.round((this.cursorValue - this.yOffset) * this.yScale);
                beginPath();
                moveTo(  -0.5, v+0.5);
                lineTo(cw+0.5, v+0.5);
                stroke();

                v = Math.round((this.cursorTime-this.startTime) * cw/(this.endTime - this.startTime + this.offsetTime));
                beginPath();
                moveTo(v+0.5,   -0.5);
                lineTo(v+0.5, ch+0.5);
                stroke();

                doDrawOverlay = true;
            }
        }

        if (doDrawOverlay) {
            with (this.frontBuffer.getContext("2d")) {
                globalCompositeOperation = "over";
                drawImage(this.overlayBuffer, 0, 0);
            }
        }

    },

    computeLabels: function (pixelSize, pixelsPerValue, minValue, maxLabels, labelIntervals, formatFunc) {
        if (pixelsPerValue == 0)
            return [];

        var yLabelHeight = pixelSize / maxLabels;

        var visibleValues = pixelSize * pixelsPerValue;
        var valuePerPixel = 1/pixelsPerValue;
        var labelValue = yLabelHeight * valuePerPixel;

        for (var i = 0; i < labelIntervals.length; i++) {
            if (labelValue < labelIntervals[i]) {
                labelValue = labelIntervals[i];
                break;
            }
        }

        // round to nearest integer, but that's it; we can try to get
        // fancy later on
        var fixedPrecision = 0;

        var labels = [];
        var firstLabelOffsetValue = Math.ceil (minValue / labelValue) * labelValue;

        var visibleYMax = minValue + pixelSize * valuePerPixel;

        for (var i = 0; i < maxLabels; i++) {
            // figure out the time value of this label
            var lvalue = firstLabelOffsetValue + i*labelValue;
            if (lvalue > visibleYMax)
                break;

            // we want the text to correspond to the value drawn at the start of the block
            // also note that Y axis is inverted
            // XXX put back the -y/2 once we figure out how to vertically center a label's text
            var lpos = ((lvalue - minValue)/valuePerPixel /* - (this.yLabelHeight/2)*/);
            var l;

            if (formatFunc) {
                l = [lpos, lvalue, formatFunc(lvalue)];
            } else {
                l = [lpos, lvalue, lvalue.toFixed(fixedPrecision).toString()];
            }

            labels.push(l);
        }

        return labels;
    },

    getValueAxisLabels: function () {
        if (this.dirty) {
            var numLabels = Math.floor(this.frontBuffer.height / this.yLabelHeight) + 1;
            this.yAxisLabels = this.computeLabels(this.frontBuffer.height, this.yScale, this.yOffset, numLabels, this.scaleLabelIntervals);
        }

        return this.yAxisLabels;
    },

    getTimeAxisLabels: function () {
        if (!this.dirty)
            return this.xAxisLabels;

        if (this.endTime == this.startTime) {
            this.xAxisLabels = [];
            return this.xAxisLabels;
        }

        /* The time axis is really crappy, because time isn't nice to work with.  We try to deal
         * in terms of time units like days etc., but that's not always possible.
         */

        // x axis is always time in seconds

        // duration is in seconds
        var duration = this.endTime - this.startTime + this.offsetTime;

        // we know the pixel size and we know the time, we can
        // compute the seconds per pixel
        var secondsPerPixel = duration / this.frontBuffer.width;

        // so what's the exact duration of one label of our desired size?
        var labelDuration = this.xLabelWidth * secondsPerPixel;

        // how many labels max can we fit?
        var numLabels = (this.frontBuffer.width / this.xLabelWidth);

        // ld == "label duration"; these are used for munging the actual time later on
        // so that we know what our intent was
        var ldMin = 0;
        var ldHour = 0;
        var ldDay = 0;

        // let's come up with a more round duration for our label.
        // this is really crappy, and we do a lot more rounding up than necessary
        if (labelDuration <= 60) {
            ldMin = 1;
            labelDuration = 60;
        } else if (labelDuration <= 15*ONE_MINUTE_SECONDS) {
            ldMin = 15;
            labelDuration = 15*ONE_MINUTE_SECONDS;
        } else if (labelDuration <= 2*ONE_HOUR_SECONDS) {
            ldHour = 1;
            labelDuration = ONE_HOUR_SECONDS;
        } else if (labelDuration <= 6*ONE_HOUR_SECONDS) {
            ldHour = 3;
            labelDuration = 3*ONE_HOUR_SECONDS;
        } else if (labelDuration <= 9*ONE_HOUR_SECONDS) {
            ldHour = 6;
            labelDuration = 6*ONE_HOUR_SECONDS;
        } else if (labelDuration <= 15*ONE_HOUR_SECONDS) {
            ldHour = 12;
            labelDuration = 12*ONE_HOUR_SECONDS;
        } else if (labelDuration <= 1.5*ONE_DAY_SECONDS) {
            ldDay = 1;
            labelDuration = ONE_DAY_SECONDS;
        } else if (labelDuration <= 2.5*ONE_DAY_SECONDS) {
            ldDay = 2;
            labelDuration = 2*ONE_DAY_SECONDS;
        } else if (labelDuration <= 3.5*ONE_DAY_SECONDS) {
            ldDay = 3;
            labelDuration = 3*ONE_DAY_SECONDS;
        } else if (labelDuration <= 4.5*ONE_DAY_SECONDS) {
            ldDay = 4;
            labelDuration = 4*ONE_DAY_SECONDS;
        } else if (labelDuration <= 5.5*ONE_DAY_SECONDS) {
            ldDay = 5;
            labelDuration = 5*ONE_DAY_SECONDS;
        } else if (labelDuration <= 6.5*ONE_DAY_SECONDS) {
            ldDay = 6;
            labelDuration = 6*ONE_DAY_SECONDS;
        } else if (labelDuration <= ONE_WEEK_SECONDS) {
            ldDay = 7;
            labelDuration = ONE_WEEK_SECONDS;
        } else {
            labelDuration = Math.ceil(duration / numLabels);
            // round to the nearest day hereog
            ldDay = 1;
        }

        // reset the number of labels based on our duration
        numLabels = Math.ceil(duration / labelDuration);

        // and then make sure they don't overlap
        if (this.frontBuffer.width / numLabels < this.xLabelWidth) {
            numLabels /= 2;
            labelDuration *= 2;
        }

        var labels = [];

        // we want our first label to fit somewhere sane.
        var firstLabelOffsetSeconds = 0;

        var firstTime = dateFromSeconds(this.startTime);
        var h = firstTime.getUTCHours();
        var m = firstTime.getUTCMinutes();
        var s = firstTime.getUTCSeconds();

        var normalize = function () {
            if (s > 59) { m += 1; s = 0; }
            if (m > 59) { h += 1; m = 0; }
            if (h > 23) h = 0;
        }

        /* always normalize the seconds */
        if (s) {
            firstLabelOffsetSeconds += ONE_MINUTE_SECONDS - s;
            m += 1; normalize();
        }

        /* then normalize minutes, either to 0 or multiple of ldMin */
        if (ldDay > 0 || ldHour > 0 || ldMin > 0) {
            var mFact = ldMin ? ldMin : 60;
            if (m) {
                firstLabelOffsetSeconds += ((60 - m) % mFact) * ONE_MINUTE_SECONDS;
                h += 1; normalize();
            }
        }

        /* then normalize hours, either to 0 or multiple of ldHour */
        if (ldDay > 0 || ldHour > 0) {
            var hFact = ldHour ? ldHour : 24;
            if (h)
                firstLabelOffsetSeconds += ((24 - h) % hFact) * ONE_HOUR_SECONDS;
        }

        //log ("sps", secondsPerPixel, "ldur", labelDuration, "nl", numLabels, "flo", firstLabelOffsetSeconds);

        for (var i = 0; i < numLabels; i++) {
            // figure out the time value of this label
            var ltime = this.startTime + firstLabelOffsetSeconds + i*labelDuration;
            if (ltime > this.endTime)
                break;

            // the first number is at what px position to place the label;
            // the second number is the actual value of the label
            // the third is an array of strings that go into the label
            var lval = [(ltime - this.startTime)/secondsPerPixel - (this.xLabelWidth/2), ltime, this.formatTimeLabel(ltime)];
            //log ("ltime", ltime, "lpos", lval[0], "end", this.endTime);
            labels.push(lval);
        }

        this.xAxisLabels = labels;

        return this.xAxisLabels;
    },

    formatTimeLabel: function (ltime) {
        // this should be overridden; we just return ltime here
        return [ltime, ""];
    },

    makeLabels: function () {
        if (this.xLabelContainer) {
            var labels = [];
            var labelValues = this.getTimeAxisLabels();

            for each (var lval in labelValues) {
                var xpos = lval[0];
                var div = $("<div class='x-axis-label'></div>")[0];
                div.style.position = "absolute";
                div.style.width = this.xLabelWidth + "px";
                div.style.height = this.xLabelHeight + "px";
                div.style.left = xpos + "px";
                div.style.top = "0px";

                $(div).append($("<div>" + lval[2].join("<br>") + "</div>"));

                labels.push(div);
            }

            $(this.xLabelContainer).empty();
            $(this.xLabelContainer).append(labels);
        }

        if (this.yLabelContainer) {
            var labels = [];
            var labelValues = this.getValueAxisLabels();
            var firstLabelShift = labelValues[labelValues.length-1][0]

            for each (var lval in labelValues) {
                var ypos = this.frontBuffer.height - Math.round((lval[1] - this.yOffset) * this.yScale);

                //var ypos = lval[0];
                var div = $("<div class='y-axis-label'></div>")[0];
                div.style.position = "absolute";
                div.style.width = this.yLabelWidth + "px";
                div.style.height = this.yLabelHeight + "px";
                div.style.left = "0px";
                // XXX remove the -8 once we figure out how to vertically center text in this box
                div.style.top = (ypos-8) + "px";

                //log ("ypos: ", ypos, " lval: ", lval);
                // XXX don't hardcode [2] etc.
                $(div).append($("<div>" + lval[2] + "</div>"));
                labels.push(div);
            }

            $(this.yLabelContainer).empty();
            $(this.yLabelContainer).append(labels);
        }

        if (0) {
            var labels = [];
            var total_sz = this.frontBuffer.height;

            // the ideal label height is 30px; 10% extra for gaps
            var sz_desired = 30;
            var nlabels = Math.floor(total_sz / (sz_desired * 1.10));
            var label_sz = Math.floor(total_sz / nlabels);

            //log ("lsz: " + label_sz + " nl: " + nlabels);

            for (var i = 0; i < nlabels; i++) {
                var pos = label_sz * i;
                var div = $("<div class='y-axis-label' style='width: 50px; height: " + label_sz + "px'></div>");
                appendChildNodes(div, "Label " + i);

                labels.push(div);
            }

            $(this.yLabelContainer).empty();
            $(this.yLabelContainer).append(labels);
        }
    },

    //
    // selection handling
    //
    selectionMouseDown: function(event) {
        if (!this.valid)
            return;

        var seltype = this.defaultSelectionType;

        /* Allow modifier keys to override selection type */
        if (event.shiftKey)
            seltype = "range";
        else if (event.ctrlKey || event.metaKey)
            seltype = "cursor";

        this.selectionType = seltype;

        if (seltype == "range") {
            var pos = $(this.frontBuffer).offset().left + this.borderLeft;
            this.dragState = { startX: event.pageX - pos };
            var ds = this.dragState;

            ds.curX = ds.startX + 1;
            ds.secondsPerPixel = (this.endTime - this.startTime + this.offsetTime) / this.frontBuffer.width;

            this.selectionStartTime = ds.startX * ds.secondsPerPixel + this.startTime;
            this.selectionEndTime = ds.curX * ds.secondsPerPixel + this.startTime;

            this.hideCursor();

            this.redrawOverlayOnly();

            this.selectionSweeping = true;
        } else if (seltype == "cursor") {
            var pos = $(this.frontBuffer).offset().left + this.borderLeft;
            var secondsPerPixel = (this.endTime - this.startTime + this.offsetTime) / this.frontBuffer.width;

            this.selectionCursorTime = (event.pageX - pos) * secondsPerPixel + this.startTime;

            this.redrawOverlayOnly();

            $(this.eventTarget).trigger("graphSelectionChanged", ["cursor", this.selectionCursorTime]);
        }
    },

    abortSelection: function() {
        if (!this.selectionSweeping)
            return;

        this.selectionSweeping = false;
        this.redrawOverlayOnly();
    },

    clearSelection: function() {
        this.selectionSweeping = false;
        this.selectionStartTime = null;
        this.selectionEndTime = null;
        this.selectionType = "none";

        this.redrawOverlayOnly();
    },

    selectionUpdateFromEventPageCoordinate: function(pagex) {
        var pos = $(this.frontBuffer).offset().left + this.borderLeft;
        var ds = this.dragState;
        ds.curX = pagex - pos;
        if (ds.curX > this.frontBuffer.width)
            ds.curX = this.frontBuffer.width;
        else if (ds.curX < 0)
            ds.curX = 0;

        var cxTime = (ds.curX * ds.secondsPerPixel) + this.startTime;
        var startxTime = (ds.startX * ds.secondsPerPixel) + this.startTime;
        if (ds.curX < ds.startX) {
            this.selectionEndTime = startxTime;
            this.selectionStartTime = cxTime;
        } else {
            this.selectionStartTime = startxTime;
            this.selectionEndTime = cxTime;
        }
    },

    selectionMouseMove: function(event) {
        if (!this.selectionSweeping)
            return;

        this.selectionUpdateFromEventPageCoordinate(event.pageX);

        this.redrawOverlayOnly();
    },

    selectionMouseUp: function(event) {
        if (!this.selectionSweeping)
            return;

        this.selectionSweeping = false;

        var pos = $(this.frontBuffer).offset().left + this.borderLeft;
        if (this.dragState.startX == event.pageX - pos) {
            // mouse didn't move
            this.selectionStartTime = null;
            this.selectionEndTime = null;

            this.redrawOverlayOnly();
        }

        $(this.eventTarget).trigger("graphSelectionChanged", ["range", this.selectionStartTime, this.selectionEndTime]);
    },

    selectionMouseOut: function(event) {
        if (!this.selectionSweeping)
            return;

        this.selectionUpdateFromEventPageCoordinate(event.pageX);
        this.redrawOverlayOnly();

        this.selectionSweeping = false;

        $(this.eventTarget).trigger("graphSelectionChanged", ["range", this.selectionStartTime, this.selectionEndTime]);
    },

    setSelection: function(type, a, b) {
        if (type == "range") {
            this.selectionType = type;
            this.selectionStartTime = a;
            this.selectionEndTime = b;

            this.redrawOverlayOnly();

            $(this.eventTarget).trigger("graphSelectionChanged", ["range", this.selectionStartTime, this.selectionEndTime]);
        } else if (type == "cursor") {
            this.selectionType = type;
            this.selectionCursorTime = a;

            this.redrawOverlayOnly();

            $(this.eventTarget).trigger("graphSelectionChanged", ["cursor", this.selectionCursorTime]);
        }
    },

    /*
     * cursor stuff
     */
    cursorMouseMove: function (event) {
        if (!this.valid)
            return;

        if (this.selectionSweeping)
            return;

        if (this.cursorType != "free" && this.cursorType != "snap")
            return;

        var pos = $(this.frontBuffer).offset();
        pos.left = pos.left + this.borderLeft;
        pos.top = pos.top + this.borderTop;
        var secondsPerPixel = (this.endTime - this.startTime + this.offsetTime) / this.frontBuffer.width;
        var valuesPerPixel = 1.0 / this.yScale;

        var pointTime = (event.pageX - pos.left) * secondsPerPixel + this.startTime;
        var pointValue = (this.frontBuffer.height - (event.pageY - pos.top)) * valuesPerPixel + this.yOffset;

        var snapToPoints = (this.cursorType == "snap");

        if (snapToPoints && this.dataSets.length > 0) {
            // find the nearest point to (pointTime, pointValue) in all the datasets
            var distanceSquared = -1;
            var nearestDSIndex, nearestPointIndex = -1;

            var kk = this.dataSets[0].indexForTime(pointTime, true);

            for (var i = 0; i < this.dataSets.length; i++) {
                var dspt = this.dataSets[i].indexForTime(pointTime, true);

                if (dspt != -1) {
                    var t = this.dataSets[i].data[dspt*2];
                    var v = this.dataSets[i].data[dspt*2+1];
                    var d = (pointTime-t)*(pointTime-t)/secondsPerPixel;
                    d += (pointValue-v)*(pointValue-v)/valuesPerPixel;

                    if (distanceSquared == -1 ||
                        d < distanceSquared)
                    {
                        nearestDSIndex = i;
                        nearestPointIndex = dspt;
                        distanceSquared = d;
                    }
                }
            }

            if (nearestPointIndex == -1)
                return;

            pointTime = this.dataSets[nearestDSIndex].data[nearestPointIndex*2] + this.offsetTime / 2.0;
            pointValue = this.dataSets[nearestDSIndex].data[nearestPointIndex*2 + 1];
        }

        this.cursorTime = pointTime;
        this.cursorValue = pointValue;

        //for adding extra_data variable to the status line 
        var extra_data = "";
        for (var i = 0; i < this.dataSets.length; i++) {
          if (this.dataSets[i].rawdata) {
            if (Math.floor(this.cursorTime)*2+1 < this.dataSets[i].rawdata.length) {
              extra_data += this.dataSets[i].rawdata[Math.floor(this.cursorTime)*2+1] + " ";
            }
          }
        }

        $(this.eventTarget).trigger("graphCursorMoved", [this.cursorTime, this.cursorValue, extra_data]);

        this.redrawOverlayOnly();
    },

    cursorMouseOut: function (event) {
        if (!this.valid)
            return;

        if (this.selectionSweeping)
            return;

        if (this.cursorType != "free" && this.cursorType != "snap")
            return;

        this.cursorTime = null;
        this.cursorValue = null;

        this.hideCursor();

        this.redrawOverlayOnly();
    },

    hideCursor: function () {
        $(this.eventTarget).trigger("graphCursorMoved", [null, null, null]);
    },

    /*
     * marker stuff
     */
    deleteAllMarkers: function () {
        this.markers = new Array();
    },

    addMarker: function (mtime, mlabel) {
        this.markers.push (mtime);
        this.markers.push (mlabel);
    },

    /*
     * utility stuff
     */
    timeValueToXY: function (time, value) {
        var pps = (this.frontBuffer.width / (this.endTime - this.startTime + this.offsetTime));
        var x = (time - this.startTime) * pps;
        var y = (value - this.yOffset) * this.yScale;

        return {x: x, y: y};
    },

    addEventList: function (element, group, handlers) {
        var h = "_" + group + "Handlers";

        if (!(h in this))
            this[h] =  [ ];

        for (var i = 0; i < handlers.length / 2; i++) {
            element.addEventListener(handlers[i*2], handlers[i*2 + 1], true);
            this[h].push(handlers[i*2]);
            this[h].push(handlers[i*2+1]);
        }
    },

    removeEventList: function (element, group) {
        var h = "_" + group + "Handlers";
        if (!(h in this))
            return;

        for (var i = 0; i < this[h].length / 2; i++)
            element.removeEventListener(this[h][i*2], this[h][i*2 + 1], true);
        this[h] = [ ];
    }

};

function DiscreteGraph(canvasId) {
    this.__proto__.__proto__.init.call (this, canvasId);
    this.offsetTime = 1;
}

DiscreteGraph.prototype = {
    __proto__: new Graph(),

    formatTimeLabel: function (ltime) {
        return ltime + "";
    },

    getTimeAxisLabels: function () {
        if (!this.dirty)
            return this.xAxisLabels;

        /* These graphs have no x axis labels */

        labels = [];
        this.xAxisLabels = labels;
        return labels;
    },

};

function CalendarTimeGraph(canvasId) {
    this.__proto__.__proto__.init.call (this, canvasId);
}

function dst(ltime) {
    var d = new Date(ltime*1000);
    var y = d.getFullYear();
    var fall, spring;

    //rules for 2007
    if (y >= 2007 ) {
        spring = new Date(y, 2, 1); // the date of Mar 1
        spring.setUTCDate(15 - spring.getUTCDay()); //second sunday in march

        fall = new Date(y, 10, 1); // the date of Nov 1
        fall.setUTCDate(8 - fall.getUTCDay()); //first sunday in november
    } else { //previous rules
        spring = new Date(y, 3, 1); // the date of april 1st
        spring.setUTCDate(8 - spring.getUTCDay()); //first sunday in april
        
        fall = new Date(y, 9, 31); //last day in october
        fall.setDate(fall.getUTCDate() - fall.getUTCDay()); //last sunday in october
    }

    // Is it Daylight or Standard time?
    return ((d > spring) && (d < fall));
}

function dateFromSeconds(ltime) {
    // ltime is in seconds since the epoch in, um, so
    //figure out dst offset for the time
    var offset = 0;
    if (dst(ltime)) {
      offset = 7*60*60*1000;
    } else {
      offset = 8*60*60*1000;
    }
    // offset adjusts time to pst/pdt - to be the same as the tinderboxes
    return new Date (ltime*1000 - offset);
}

function formatTime(ltime, twoLines) {
    var d = dateFromSeconds(ltime);

    var h = d.getUTCHours();
    var m = d.getUTCMinutes();
    var s = d.getUTCSeconds();

    var timestr = (h == 0 ? "12" : (h > 12 ? h - 12 : h)) +
        (m < 10 ? ":0" : ":") + m + (s > 0 ? ((s < 10 ? ":0" : ":") + s) : "");

    if (h < 12)
        timestr += " AM";
    else
        timestr += " PM";

    if (twoLines) {
        var datestr = d.getUTCDate() + " " + MONTH_ABBREV[d.getUTCMonth()] + " " + d.getUTCFullYear();

        if (h + m + s == 0) {
            timestr = "";
        }

        return [datestr, timestr];
    } else {
        var yr = d.getUTCFullYear();
        //if (yr > 100) yr -= 100;
        //if (yr < 10) yr = "0" + yr;
        var datestr = (d.getUTCMonth()+1) + "/" + d.getUTCDate() + "/" + yr;
        return datestr + " " + timestr;
    }
}

CalendarTimeGraph.prototype = {
    __proto__: new Graph(),

    formatTimeLabel: function (ltime) {
        return formatTime(ltime, true);
    },

};



