(function(window, document, undefined){
	// Draw object
	// All basic drawing goes in here
	var Draw = function(){
		this.svgNS = "http://www.w3.org/2000/svg";
		this.svg = undefined;
		this.container = undefined;
	};

	Draw.prototype.setAttributes = function(elem, attr){
		for (var i=0 ; i<attr.length ; i++) elem.setAttributeNS(null, attr[i][0], attr[i][1]);
		return elem;
	};

	Draw.prototype.group = function(id, parent){
		parent = parent || this.svg;
		var g = document.createElementNS(this.svgNS, 'g'),
			args = [['id', id]];
		this.setAttributes(g, args);
		parent.appendChild(g);
		return g;
	};

	Draw.prototype.point = function(o){
		o.stroke = o.stroke || 'black';
		o.fill = o.fill || 'white';
		o._parent = o._parent || this.svg;
		var c = document.createElementNS(this.svgNS, "circle"),
			args = [['cx', o.x], ['cy', o.y], ['r', 5], ['fill', o.fill], ['stroke', o.stroke]];

		this.setAttributes(c, args);

		o._parent.appendChild(c);
	};

	Draw.prototype.line = function(x1, y1, x2, y2, stroke, fill){
		stroke = stroke || 'gray';
		fill = fill || 'gray';
		var c = document.createElementNS(this.svgNS, "line"),
			args = [['x1', x1], ['y1', y1], ['x2', x2], ['y2', y2], ['fill', fill], ['stroke', stroke]];

		this.setAttributes(c, args);

		this.svg.appendChild(c);
	};

	Draw.prototype.clear = function(){ while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild); };

	Draw.prototype.buildSVG = function(){
		this.svg = document.createElementNS(this.svgNS, "svg");
		this.container.appendChild(this.svg);
	};

	Draw.prototype.text = function(x, y, text, options){
		var c, t, args, opt;

		options.fill = options.fill || 'black';
		options.stroke = options.stroke || 'none';
		options.fontSize = options.fontSize || '14';
		options.fontFamily = options.fontFamily || 'Arial';
		options.align = options.align || 'start'; // or middle or end

		t = document.createTextNode(text);
		c = document.createElementNS(this.svgNS, "text");
		c.appendChild(t);

		// Set SVG text attributes
		args = [['x', x], ['y', y], ['fill', options.fill], ['stroke', options.stroke], ['font-size', options.fontSize+"px"],
				['font-family', options.fontFamily], ['text-anchor', options.align], ['baseline-shift', '-0.5ex']]; // baseline: vertical align

		this.setAttributes(c, args);

		this.svg.appendChild(c);
	};

	Draw.prototype.path = function(pathData, fill, stroke){
		stroke = stroke || 'black';
		fill = fill || 'none';

		var path = document.createElementNS(this.svgNS,"path"),
			args = [['d', pathData], ['fill', fill], ['stroke', stroke]];

		for (var i=0 ; i<args.length ; i++) path.setAttributeNS(null, args[i][0], args[i][1]);

		this.svg.appendChild(path);
	};


	// Util object
	// Collection of utility fonctions
	var Util = function(){};

	Util.distance = function(a, b){ return Math.sqrt(Math.pow(a.x-b.x, 2)+Math.pow(a.y-b.y, 2)); };
	Util.symmetric = function(a, b){ return {x: 2*b.x-a.x, y: 2*b.y-a.y}; }; // point reflection
	Util.middle = function(a, b){ return Math.min(a, b) + (Math.abs(a-b)/2); };
	Util.magnitude = function(x){ return x.toString().length; };

	// Event handler
	Util.addEvent = function(e, type, f){
		if (e.attachEvent){
			e.attachEvent('on'+type, f);
		}else if (e.addEventListener){
			e.addEventListener('resize', f, false);
		}
	};


	// Graph object
	// Smoothcurve HQ
	var Graph = function(){
		// Graph properties
		this.leftMargin = 0;
		this.bottomMargin = 0;
		this.simpleMargin = 0; // Top & Right margin
		this.w = 0; // container width
		this.h = 0; // container height
		this.drawing = new Draw(); // Draw utilities functions
		// Customizable properties
		this.margin = 40;
		this.innerMargin = 20;
		this.fontSize = 14; // in px
		this.fontFamily = 'Arial';
		this.data = []; // Raw data
		this.points = []; // Data fitted to container
		this.container = undefined;
	};

	// Initialization method
	Graph.prototype.draw = function(options){
		var that, key = null;

		// Initialization
		this.container = options.container;
		this.data = options.data;
		this.margin = options.margin || this.margin;
		this.innerMargin = options.innerMargin || this.innerMargin;
		this.fontSize = options.fontSize || this.fontSize;
		this.fontFamily = options.fontFamily || this.fontFamily;
		
		this.initDimensions();


		this.drawing.container = this.container;
		this.drawing.buildSVG();
		this.drawGraph();
		that = this;
		Util.addEvent(window, 'resize', function(e){
			if (key) {
				clearTimeout(key);
			}
			var delay = function(){ that.drawGraph(); };
			key = setTimeout(delay, 300);
		});
	};

	// Steps to draw the graph
	Graph.prototype.drawGraph = function(){
		this.initDimensions();
		this.drawing.clear();
		this.sort();
		this.scale();
		this.reverse();
		this.drawing.path(this.buildSVGPath());
		this.buildPoints();
		this.setAxis();
	};

	// Compute margins, y values extrema, container dimensions
	Graph.prototype.initDimensions = function(){
		var yExtrema = this.yExtrema();
		this.simpleMargin = this.margin + this.innerMargin;
		this.leftMargin = Util.magnitude(yExtrema.max.data)*this.fontSize;
		this.w = this.container.clientWidth;
		this.h = this.container.clientHeight;
	};

	Graph.prototype.sort = function(){
		this.data.sort(function(a, b){
			if (a.x > b.x) return 1;
			else return -1;
		});
	};

	// Scale data to fit inside container [data->points]
	Graph.prototype.scale = function(){
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
	};

	// Reverse vertically because ordinate is upside-down in SVG
	Graph.prototype.reverse = function(){
		for (var i=0 ; i < this.points.length ; i++){
			this.points[i].x = this.points[i].x+this.simpleMargin+this.leftMargin;
			this.points[i].y = this.container.clientHeight-this.points[i].y-this.simpleMargin-this.fontSize;
		}
	};

	// Compute how much 'y' you get when you cover one 'x'
	Graph.prototype.coefficient = function(a, b){
		if (a.x != b.x) return (a.y-b.y)/(a.x-b.x);
		else return 0;
	};

	// Compute the x position of a control point
	// b is a point between a and c
	Graph.prototype.ctrlX = function(cft, a, b, c){
		// Control distance computation
		var minDist = Math.min(Math.abs(a.x-b.x), Math.abs(c.x-b.x)),
			dist = (Math.abs(a.x-b.x)+ Math.abs(c.x-b.x)), // distance between a & c
			ctrl;

		ctrl = 0.07*dist+0.63*minDist; // weighted average
		if (ctrl > minDist) ctrl = minDist;
		return ctrl*Math.sqrt(1/(1+Math.pow(cft, 2)));
	};

	Graph.prototype.ctrlY = function(cft, a, b, c){ return this.ctrlX(cft, a, b, c)*cft; };

	// Give the control point coordinates of a given point b
	Graph.prototype.controlPoint = function(a, b, c, flat, reversed){
		var cft, ctrlPt;
		flat = flat || false;
		reversed = reversed || false;
		
		if (a.x == c.x && a.y == c.y) cft = this.coefficient(a, b);
		else cft = this.coefficient(a, c);

		if (flat) ctrlPt = (b.x-this.ctrlX(0, a, b, c))+','+(b.y);
		else if (reversed) ctrlPt = (b.x+this.ctrlX(cft, a, b, c))+','+(b.y+this.ctrlY(cft, a, b, c));
		else ctrlPt = (b.x-this.ctrlX(cft, a, b, c))+','+(b.y-this.ctrlY(cft, a, b, c));

		return ctrlPt;
	};

	// Check if b is a local extremum
	Graph.prototype.isExtremum = function(a, b, c){
		if ((a.y <= b.y && c.y <= b.y) || (a.y >= b.y && c.y >= b.y)) return true;
		else return false;
	};

	// Build the string given to the SVG path
	Graph.prototype.buildSVGPath = function(){
		var d = this.points, // Shortcut
			data = 'M'+d[0].x+','+d[0].y; // 1st point

		if (d.length > 2){
			// 1st control point
			data += 'C'+this.controlPoint(Util.symmetric(d[1], d[0]), d[0], d[1], false, true);

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
	};

	Graph.prototype.buildSVGPathLinear = function(){
		var d = this.points, // Shortcut
			data = 'M'+d[0].x+','+d[0].y; // 1st point

		for (var i=1 ; i<d.length ; i++){
			data += 'L'+d[i].x+','+d[i].y;
		}

		return data;
	};

	Graph.prototype.buildPoints = function(){
		var g = this.drawing.group('points');

		for (var i=0 ; i < this.points.length ; i++){
			this.drawing.point({
				x: this.points[i].x,
				y: this.points[i].y,
				_parent: g
			});
		}
	};

	Graph.prototype.setAxis = function(){
		var m, yExtrema;
		m = this.margin;
		yExtrema = this.yExtrema();

		this.drawing.line(m+this.leftMargin, this.h-m-this.fontSize, this.w-m, this.h-m-this.fontSize); // horizontal line
		this.drawing.line(m+this.leftMargin, m, m+this.leftMargin, this.h-m-this.fontSize); // vertical line

		// Horizontal labels
		this.label(this.points[0].x, this.h-m+10, this.data[0].x); // first x label
		this.label(this.points[this.points.length-1].x, this.h-m+10, this.data[this.data.length-1].x); // last x label
		this.setLabels(this.points[0].x, this.points[this.points.length-1].x, this.data[0].x, this.data[this.data.length-1].x, 'x'); // all other x labels

		// Vertical labels
		this.label(m+this.leftMargin-10, yExtrema.min.points, yExtrema.min.data, "end"); // first y label
		this.label(m+this.leftMargin-10, yExtrema.max.points, yExtrema.max.data, "end"); // last y label
		this.setLabels(yExtrema.min.points, yExtrema.max.points, yExtrema.min.data, yExtrema.max.data, 'y'); // all other y labels
	};

	Graph.prototype.label = function(x, y, text, align){
		var c, t, a, m;

		m = this.margin;
		align = align || "middle";

		// Text
		this.drawing.text(x, y, text, {
			align: align,
			fontSize: this.fontSize,
			fontFamily: this.fontFamily
		});

		// Little line on the abscissa/ordinate
		if (align == "middle") this.drawing.line(x, y-this.fontSize-6, x, y-this.fontSize-14);
		if (align == "end") this.drawing.line(x+6, y, x+14, y);
	};

	// Recursively compute where the labels between a & b should be positioned
	Graph.prototype.setLabels = function(a, b, av, bv, axis){
		var c, cv, m, cond;
		m = this.margin;

		if (axis == 'x') cond = Math.abs(a-b) >= this.labelWidth()*this.fontSize*1.5;
		if (axis == 'y') cond = Math.abs(a-b) >= this.fontSize*6;

		if (cond){
			c = Util.middle(a, b);
			cv = Util.middle(av, bv);
			if (axis == 'x') this.label(c, this.h-m+10, Math.round(cv*10)/10);
			if (axis == 'y') this.label(m+this.leftMargin-10, c, Math.round(cv*10)/10, "end");
			this.setLabels(a, c, av, cv, axis);
			this.setLabels(c, b, cv, bv, axis);
		}
	};

	// Fetch the maximum/minimum values of y
	Graph.prototype.yExtrema = function(){
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
	};

	// Get the (hypothetic) largest value of a x label
	Graph.prototype.labelWidth = function(){
		var sizeOfLastLabel = Math.max(Util.magnitude(Math.round(this.data[this.data.length-1].x*100)/100), Util.magnitude(Math.round(this.data[0].x*100)/100));
		if (sizeOfLastLabel > 4){
			return sizeOfLastLabel;
		}else{
			return 4;
		}
	};

	window.Graph = Graph;

})(window, document);