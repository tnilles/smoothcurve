var chart = {
	margin: 40,
	data: [],
	points: [],
	container: undefined,
	svg: undefined,
	svgNS: "http://www.w3.org/2000/svg",

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
		destWidth -= this.margin*2,
		destHeight -= this.margin*2;

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
			this.points[i].x = this.points[i].x+this.margin;
			this.points[i].y = this.container.clientHeight-this.points[i].y-this.margin;
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
		var minDist = (Math.abs(a.x-b.x)+ Math.abs(c.x-b.x))/10;
		minDist += 7*Math.min(Math.abs(a.x-b.x), Math.abs(c.x-b.x))/10;
		var ctrl = 0.7*minDist;
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

	clearSVG: function(){
		while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
	},

	buildSVG: function(){
		this.svg = document.createElementNS(this.svgNS, "svg");
		this.container.appendChild(this.svg);
	},

	drawGraph: function(){
		var pathData, path;

		this.clearSVG();
		this.scale();
		this.reverse();
		pathData = this.buildSVGPath();

		path = document.createElementNS(this.svgNS,"path");
		path.setAttributeNS(null, "fill", "none");
		path.setAttributeNS(null, "stroke", "black");
		path.setAttributeNS(null, "d", pathData);
		this.svg.appendChild(path);

		this.buildPoints();
	},

	draw: function(options){
		var key = null;

		// Initialization
		this.container = options.container;
		this.data = options.data;
		this.margin = options.margin || this.margin;

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