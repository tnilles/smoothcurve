var chart = {
	svgNS: "http://www.w3.org/2000/svg",
	svg: undefined,
	leftMargin: 0,
	bottomMargin: 0,
	simpleMargin: 0, // top & right margin
	w: 0, // container width
	h: 0, // containe height

	// Customizable
	margin: 40,
	innerMargin: 20,
	fontSize: 14, // in pixels
	fontFamily: "Arial",
	data: [],
	points: [],
	container: undefined,
	
	// Get container dimensions & compute margins
	initDimensions: function(){
		var yExtrema = this.yExtrema();
		this.simpleMargin = this.margin + this.innerMargin;
		this.leftMargin = this.magnitude(yExtrema.max.data)*this.fontSize;
		this.w = this.container.clientWidth;
		this.h = this.container.clientHeight;
	},

	// Sort elements by x asc
	sort: function(){
		this.data.sort(function(a, b){
			if (a.x > b.x) return 1;
			else return -1;
		});
	},

	// Scale the chart to fit inside the parent element
	scale: function(){
		var mnx, mny, mxx, mxy, sourceWidth, sourceHeight,
			destWidth, destHeight, xcoeff, ycoeff;

		// Fetch parent's width/height
		destWidth = this.container.clientWidth;
		destHeight = this.container.clientHeight;

		// Get extrema values (left/right/top/down)
		mnx = this.data[0].x,
		mny = this.data[0].y,
		mxx = this.data[0].x,
		mxy = this.data[0].y;

		for (var i=0 ; i < this.data.length ; i++){
			if (this.data[i].x < mnx) mnx = this.data[i].x;
			if (this.data[i].y < mny) mny = this.data[i].y;
			if (this.data[i].x > mxx) mxx = this.data[i].x;
			if (this.data[i].y > mxy) mxy = this.data[i].y;
		}

		// Scaling coefficients
		sourceWidth = mxx - mnx,
		sourceHeight = mxy - mny,
		destWidth -= this.simpleMargin*2 + this.leftMargin,
		destHeight -= this.simpleMargin*2 + this.fontSize;

		xcoeff = destWidth/sourceWidth;
		ycoeff = destHeight/sourceHeight;

		// Scale all points
		for (i=0 ; i < this.data.length ; i++){
			this.points[i] = {};
			this.points[i].x = Math.ceil((this.data[i].x-mnx)*xcoeff);
			this.points[i].y = Math.ceil((this.data[i].y-mny)*ycoeff);
		}
	},

	// Move the origin from top left to bottom left + add margins
	reverse: function(){
		for (var i=0 ; i < this.points.length ; i++){
			this.points[i].x = this.points[i].x+this.simpleMargin+this.leftMargin;
			this.points[i].y = this.container.clientHeight-this.points[i].y-this.simpleMargin-this.fontSize;
		}
	},

	// Get the coefficient cft of the line formed by 2 points (as in y = cft*x + cst)
	coefficient: function(a, b){
		if (a.x != b.x) return (a.y-b.y)/(a.x-b.x);
		else return 0;
	},

	// Compute the x position of a control point
	// b is a point between a and c
	ctrlX: function(cft, a, b, c){
		// Control distance computation
		var minDist = Math.min(Math.abs(a.x-b.x), Math.abs(c.x-b.x)),
			dist = (Math.abs(a.x-b.x)+ Math.abs(c.x-b.x)), // distance between a & c
			ctrl;

		ctrl = 0.07*dist+0.63*minDist; // weighted average
		if (ctrl > minDist) ctrl = minDist;
		return ctrl*Math.sqrt(1/(1+Math.pow(cft, 2)));
	},

	ctrlY: function(cft, a, b, c){
		return this.ctrlX(cft, a, b, c)*cft;
	},

	distance: function(a, b){
		return Math.sqrt(Math.pow(a.x-b.x, 2)+Math.pow(a.y-b.y, 2));
	},

	// Give the control point coordinates of a given point b
	controlPoint: function(a, b, c, flat, reversed){
		var cft, ctrlPt;
		flat = flat || false;
		reversed = reversed || false;
		
		if (a.x == c.x && a.y == c.y) cft = this.coefficient(a, b);
		else cft = this.coefficient(a, c);

		if (flat) ctrlPt = (b.x-this.ctrlX(0, a, b, c))+','+(b.y);
		else if (reversed) ctrlPt = (b.x+this.ctrlX(cft, a, b, c))+','+(b.y+this.ctrlY(cft, a, b, c));
		else ctrlPt = (b.x-this.ctrlX(cft, a, b, c))+','+(b.y-this.ctrlY(cft, a, b, c));

		return ctrlPt;
	},

	// Give the symetric point of a by b
	symetric: function(a, b){
		return {x: 2*b.x-a.x, y: 2*b.y-a.y};
	},

	// Check if b is a local extremum
	isExtremum: function(a, b, c){
		if ((a.y <= b.y && c.y <= b.y) || (a.y >= b.y && c.y >= b.y)) return true;
		else return false;
	},

	// Build the string given to the SVG path
	buildSVGPath: function(){
		var d = this.points, // Shortcut
			data = 'M'+d[0].x+','+d[0].y; // 1st point

		if (d.length > 2){
			// 1st control point
			data += 'C'+this.controlPoint(this.symetric(d[1], d[0]), d[0], d[1], false, true);

			// 2nd control point
			//	If the 2nd point is a local extremum, the line formed by its control points should be horizontal
			if (this.isExtremum(d[0], d[1], d[2])){
				data += ','+this.controlPoint(d[0], d[1], d[2], true);
			}else{
				data += ','+this.controlPoint(d[0], d[1], d[2]);
			}
			
			data += ','+d[1].x+','+d[1].y; // 2nd point

			for (var i=2 ; i<d.length ; i++){
				if (i+1<d.length){
					// If the point is a local extremum, the control "line" should be horizontal
					if (this.isExtremum(d[i-1], d[i], d[i+1])){
						data += 'S'+this.controlPoint(d[i-1], d[i], d[i+1], true);
						data += ','+d[i].x+','+d[i].y;
					}else{
						data += 'S'+this.controlPoint(d[i-1], d[i], d[i+1]);
						data += ','+d[i].x+','+d[i].y;
					}
				}else{ // last point
					data += 'S'+this.controlPoint(d[i-1], d[i], d[i-1]);
					data += ','+d[i].x+','+d[i].y;
				}
			}
		}else{
			data += ' '+d[1].x+','+d[1].y;
		}

		return data;
	},

	buildPoints: function(){
		for (var i=0 ; i < this.points.length ; i++){
			this.setPoint(this.points[i].x, this.points[i].y);
		}
	},

	setPoint: function(x, y, stroke, fill){
		stroke = stroke || 'black';
		fill = fill || 'white';
		var c = document.createElementNS(this.svgNS, "circle");

		c.setAttributeNS(null, "cx", x);
		c.setAttributeNS(null, "cy", y);
		c.setAttributeNS(null, "r", 5);
		c.setAttributeNS(null, "fill", fill);
		c.setAttributeNS(null, "stroke", stroke);
		this.svg.appendChild(c);
	},

	setLine: function(x1, y1, x2, y2){
		var c = document.createElementNS(this.svgNS, "line");

		c.setAttributeNS(null, "x1", x1);
		c.setAttributeNS(null, "y1", y1);
		c.setAttributeNS(null, "x2", x2);
		c.setAttributeNS(null, "y2", y2);
		c.setAttributeNS(null, "fill", "gray");
		c.setAttributeNS(null, "stroke", "gray");
		this.svg.appendChild(c);
	},

	setAxis: function(){
		var m, yExtrema;
		m = this.margin;
		yExtrema = this.yExtrema();

		this.setLine(m+this.leftMargin, this.h-m-this.fontSize, this.w-m, this.h-m-this.fontSize); // horizontal line
		this.setLine(m+this.leftMargin, m, m+this.leftMargin, this.h-m-this.fontSize); // vertical line

		// Horizontal labels
		this.label(this.points[0].x, this.h-m+10, this.data[0].x);
		this.label(this.points[this.points.length-1].x, this.h-m+10, this.data[this.data.length-1].x);
		this.setLabels(this.points[0].x, this.points[this.points.length-1].x, this.data[0].x, this.data[this.data.length-1].x, 'x');

		// Vertical labels
		this.label(m+this.leftMargin-10, yExtrema.min.points, yExtrema.min.data, "right");
		this.label(m+this.leftMargin-10, yExtrema.max.points, yExtrema.max.data, "right");
		this.setLabels(yExtrema.min.points, yExtrema.max.points, yExtrema.min.data, yExtrema.max.data, 'y');
	},

	setLabels: function(a, b, av, bv, axis){
		var c, cv, m, cond;
		m = this.margin;

		if (axis == 'x') cond = Math.abs(a-b) >= this.labelWidth()*this.fontSize*1.5;
		if (axis == 'y') cond = Math.abs(a-b) >= this.fontSize*6;

		if (cond){
			c = this.middle(a, b);
			cv = this.middle(av, bv);
			if (axis == 'x') this.label(c, this.h-m+10, Math.round(cv*10)/10);
			if (axis == 'y') this.label(m+this.leftMargin-10, c, Math.round(cv*10)/10, "right");
			this.setLabels(a, c, av, cv, axis);
			this.setLabels(c, b, cv, bv, axis);
		}
	},

	middle: function(a, b){
		return Math.min(a, b) + (Math.abs(a-b)/2);
	},

	yExtrema: function(){
		var e;
		e = {min: {data: this.data[0].y},
			max: {data: this.data[0].y}};

		if (this.points.length > 0){
			e.min.points = this.points[0].y;
			e.max.points = this.points[0].y;
		}

		for (var i=0 ; i<this.data.length ; i++){
			if (this.data[i].y < e.min.data){
				e.min.data = this.data[i].y;
				if (this.points.length > 0) e.min.points = this.points[i].y;
			}

			if (this.data[i].y > e.max.data){
				e.max.data = this.data[i].y;
				if (this.points.length > 0) e.max.points = this.points[i].y;
			}
		}

		return e;
	},

	labelWidth: function(){
		var sizeOfLastLabel = Math.max(this.magnitude(Math.round(this.data[this.data.length-1].x*100)/100), this.magnitude(Math.round(this.data[0].x*100)/100));
		if (sizeOfLastLabel > 4){
			return sizeOfLastLabel;
		}else{
			return 4;
		}
	},

	label: function(x, y, text, align){
		var c, t, a, m;

		m = this.margin;
		align = align || "center";

		// Text
		t = document.createTextNode(text);
		c = document.createElementNS(this.svgNS, "text");
		c.appendChild(t);

		c.setAttributeNS(null, "x", x);
		c.setAttributeNS(null, "y", y);
		c.setAttributeNS(null, "fill", "black");
		c.setAttributeNS(null, "stroke", "none");
		c.setAttributeNS(null, "font-size", this.fontSize+"px");
		c.setAttributeNS(null, "font-family", this.fontFamily);
		if (align == "center") c.setAttributeNS(null, "text-anchor", "middle");
		if (align == "right") c.setAttributeNS(null, "text-anchor", "end");
		c.setAttributeNS(null, "baseline-shift", "-0.5ex"); // vertical align
		this.svg.appendChild(c);

		// Little line
		if (align == "center") this.setLine(x, y-20, x, y-28);
		if (align == "right") this.setLine(x+6, y, x+14, y);
	},

	magnitude: function(x){
		return x.toString().length;
	},

	clearSVG: function(){
		while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
	},

	buildSVG: function(){
		this.svg = document.createElementNS(this.svgNS, "svg");
		this.container.appendChild(this.svg);
	},

	drawGraph: function(){
		var pathData, path;

		this.initDimensions();
		this.clearSVG();
		this.sort();
		this.scale();
		this.reverse();
		pathData = this.buildSVGPath();

		path = document.createElementNS(this.svgNS,"path");
		path.setAttributeNS(null, "fill", "none");
		path.setAttributeNS(null, "stroke", "black");
		path.setAttributeNS(null, "d", pathData);
		this.svg.appendChild(path);

		this.buildPoints();
		this.setAxis();
	},

	draw: function(options){
		var key = null;

		// Initialization
		this.container = options.container;
		this.data = options.data;
		this.margin = options.margin || this.margin;
		this.innerMargin = options.innerMargin || this.innerMargin;
		this.fontSize = options.fontSize || this.fontSize;
		this.fontFamily = options.fontFamily || this.fontFamily;
		this.initDimensions();

		this.buildSVG();
		this.drawGraph(d);
		var that = this;
		window.onresize = function(e){
			console.log(e);
			if (key) {
				clearTimeout(key);
			}
			var delay = function(){ that.drawGraph(); };
			key = setTimeout(delay, 300);
		};
	}
};