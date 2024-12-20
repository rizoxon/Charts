export default class Line extends HTMLElement{
	#data;
	#canvas;
	#ctx;
	#tooltip;
	#font = "16px Quicksand";

	#grid_color = getComputedStyle(document.querySelector(":root")).getPropertyValue("--color-text-secondary") || "gray";
	#x_axis_line_color = getComputedStyle(document.querySelector(":root")).getPropertyValue("--color-text-primary") || "black";
	#x_axis_text_color = getComputedStyle(document.querySelector(":root")).getPropertyValue("--color-text-primary") || "black";
	#y_axis_line_color = getComputedStyle(document.querySelector(":root")).getPropertyValue("--color-text-primary") || "black";
	#y_axis_text_color = getComputedStyle(document.querySelector(":root")).getPropertyValue("--color-text-primary") || "black";
	#rotated_labels = false;
	#total_text_markers_length = 0;

	#padding = 20;
	#paddings;
	#min_value = Infinity;
	#max_value = -Infinity;
	#longest_dataset = 0;
	#gap_x_axis = 0;
	#gap_y_axis = 0;
	#scale_y;
	#marker_size = 10;
	#marker_count_y_axis = 10;
	#y_axis_step_value;
	#circle_rad = 4;
	#grid_line_width = 0.2;

	#canvas_DPI_width = 0;
	#canvas_DPI_height = 0;

	constructor(){
		super();

		this.shadow = this.attachShadow({mode: 'closed'});
		this.#data = JSON.parse(this.innerHTML);

		// Style element
		const style = document.createElement('style');
		style.textContent = `
			:host{
				display: inline-block;
				width: 100%;
				height: 100%;
				max-width: 100dvw;
				max-height: 100dvh;
			}
			canvas{
				width: 100%;
				height: 100%;
			}
			div#XE_charts_line_tooltip{
				position: absolute;
				display: none;
				background-color: rgba(0, 0, 0, 0.7);
				color: white;
				padding: 5px;
				border-radius: 5px;
				pointer-events: none;
				font-size: 0.7em;
			}
		`;
		this.shadow.appendChild(style);

		// Tooltip element
		this.#tooltip = document.createElement("div");
		this.#tooltip.setAttribute("id", "XE_charts_line_tooltip");
		this.shadow.appendChild(this.#tooltip);

		// Canvas element
		this.shadow.appendChild(document.createElement("canvas"));
		this.#canvas = this.shadow.querySelector("canvas");
		this.#ctx = this.#canvas.getContext('2d');

		this.#resize_observer();

		this.#init_on_hover_points();
	}

	////// APIs
	#resize_observer(){
		const resize_observer_object = new ResizeObserver(this.#init);
		resize_observer_object.observe(this.parentNode);
	}

	#init = ()=>{
		this.#set_up_canvas();
		this.#init_values();
		this.#calculate_values();

		this.#draw_legends();

		this.#draw_grid_x_lines();
		this.#draw_grid_y_lines();

		this.#draw_data_fill_type_opacity_or_plain();
		this.#draw_data_fill_type_gradient();

		this.#draw_x_axis_line();
		this.#draw_x_axis_markers();

		this.#draw_y_axis_line();
		this.#draw_y_axis_markers();

		this.#draw_data_lines();
		this.#draw_data_points();
	}

	////// Helpers
	#set_up_canvas(){
		const DPR = window.devicePixelRatio || 1;

		// First set CSS dimensions
		this.#canvas.style.width = '100%';
		this.#canvas.style.height = '100%';

		// Get the size in CSS pixels after CSS is applied
		const computed_style = getComputedStyle(this.#canvas);
		const css_width = parseFloat(computed_style.width);
		const css_height = parseFloat(computed_style.height);

		// Get the sizes before DPI scaling for calcs
		this.#canvas_DPI_width = css_width;
		this.#canvas_DPI_height = css_height;

		// Adjust canvas buffer size for DPR
		this.#canvas.width = css_width * DPR;
		this.#canvas.height = css_height * DPR;

		// Scale the context for DPR
		this.#ctx.scale(DPR, DPR);
	}

	#init_values(){
		if("x_axis" in this.#data){
			if(this.#data["x_axis"]["line_color"]) this.#x_axis_line_color = this.#data["x_axis"]["line_color"];
			if(this.#data["x_axis"]["text_color"]) this.#x_axis_text_color = this.#data["x_axis"]["text_color"];
		}

		if("y_axis" in this.#data){
			if(this.#data["y_axis"]["line_color"]) this.#y_axis_line_color = this.#data["y_axis"]["line_color"];
			if(this.#data["y_axis"]["text_color"]) this.#y_axis_text_color = this.#data["y_axis"]["text_color"];
		}

		if("grid" in this.#data && this.#data["grid"]["color"]) this.#grid_color = this.#data["grid"]["color"];

		// Marker count Y axis
		if("y_axis" in this.#data && "marker_count" in this.#data["y_axis"]) this.#marker_count_y_axis = this.#data["y_axis"]["marker_count"];

		// Finding min max
		for(let i = 0; i < this.#data["data"].length; i++){
			const min = Math.min(...this.#data["data"][i]["values"]);
			const max = Math.max(...this.#data["data"][i]["values"]);
			if(min < this.#min_value) this.#min_value = min;
			if(max > this.#max_value) this.#max_value = max;

			// Longest dataset
			if(this.#data["data"][i]["values"].length > this.#longest_dataset) this.#longest_dataset = this.#data["data"][i]["values"].length;
		}

		this.#paddings = {
			top: this.#padding,
			right: this.#canvas_DPI_width - this.#padding,
			bottom: this.#canvas_DPI_height - this.#padding,
			left: this.#padding
		};
	}

	#calculate_values(){
		this.#ctx.font = this.#font;
		let legend_height = this.#ctx.measureText(this.#data["data"][0]["label"]).actualBoundingBoxAscent + this.#ctx.measureText(this.#data["data"][0]["label"]).actualBoundingBoxDescent;
		let initial_line_height = this.#canvas_DPI_height - this.#padding * 2;
		let actual_line_height = initial_line_height;


		if(this.#data["legends"] === true){
			this.#paddings["top"] += legend_height + this.#padding;
			actual_line_height = initial_line_height - (this.#paddings["top"] + this.#padding);
		}

		if("x_axis" in this.#data && this.#data["x_axis"]["label"] === true){
			this.#paddings["bottom"] -= legend_height + this.#padding;

			let rotated_longest_marker_width = 0;
			if("markers" in this.#data["x_axis"] && this.#data["x_axis"]["markers"].length > 1){
				if(this.#total_text_markers_length == 0)
					for(const marker of this.#data["x_axis"]["markers"]){
						this.#total_text_markers_length += this.#ctx.measureText(marker).width + this.#padding * 2;
					}

				this.#paddings["left"] += this.#ctx.measureText(this.#data["x_axis"]["markers"][0]).width / 2;
				this.#paddings["right"] -= this.#ctx.measureText(this.#data["x_axis"]["markers"][this.#data["x_axis"]["markers"].length - 1]).width / 2;

				this.#rotated_labels = false;
				if(this.#total_text_markers_length>= this.#canvas_DPI_width) this.#rotated_labels = true;
				if(this.#rotated_labels == true){
					let longest_marker_text = this.#data["x_axis"]["markers"].slice().sort((a, b) => b.length - a.length)[0];
					rotated_longest_marker_width = this.#ctx.measureText(longest_marker_text).width;
					this.#paddings["bottom"] -= rotated_longest_marker_width;
				}
			}

			actual_line_height = initial_line_height - (this.#paddings["top"] + legend_height + rotated_longest_marker_width);
		}

		if("y_axis" in this.#data && this.#data["y_axis"]["label"] === true){
			let actual_space = this.#paddings["left"] - (this.#ctx.measureText(this.#max_value).width + this.#padding * 2);
			this.#paddings["left"] += actual_space > 0 ? 0 : (actual_space * -1) + this.#padding;
		}

		this.#gap_x_axis = (this.#paddings["right"] - this.#paddings["left"]) / (this.#longest_dataset - 1);
		this.#gap_y_axis = (this.#paddings["bottom"] - this.#paddings["top"]) / (this.#marker_count_y_axis - 1);
		this.#scale_y = actual_line_height / (this.#max_value - this.#min_value);
		this.#y_axis_step_value = (this.#max_value - this.#min_value) / (this.#marker_count_y_axis - 1);
	}

	#draw_x_axis_line(){
		if(!("x_axis" in this.#data) || this.#data["x_axis"]["label"] !== true) return;

		this.#ctx.beginPath();
		this.#ctx.setLineDash([this.#data["x_axis"]["line_dash"] || 0]);
		this.#ctx.moveTo(this.#paddings.left, this.#paddings.bottom);
		this.#ctx.lineTo(this.#paddings.right, this.#paddings.bottom);

		this.#ctx.strokeStyle = this.#x_axis_line_color;
		this.#ctx.lineWidth = 1;
		this.#ctx.stroke();
	}

	#draw_x_axis_markers(){
		if(!("x_axis" in this.#data) || this.#data["x_axis"]["label"] !== true) return;

		let has_markers = false;
		if(this.#data["x_axis"]["markers"] && this.#data["x_axis"]["markers"].length > 1) has_markers = true;
		const markers_length = has_markers ? this.#data["x_axis"]["markers"].length : this.#longest_dataset;
		const gap_x_axis = has_markers ? (this.#paddings["right"] - this.#paddings["left"]) / (markers_length - 1) : this.#gap_x_axis;

		this.#ctx.font = this.#font;
		this.#ctx.fillStyle = this.#x_axis_text_color;

		for(let i = 0; i < markers_length; i++){
			const x = i * gap_x_axis + this.#paddings["left"];
			const label = has_markers ? this.#data["x_axis"]["markers"][i] : i;

			if(this.#rotated_labels === true){
				this.#ctx.save();
				this.#ctx.translate(x, this.#paddings["bottom"] + this.#padding);
				this.#ctx.rotate(Math.PI / 2);
				this.#ctx.textAlign = "left";
				this.#ctx.fillText(label, 0, 0);
				this.#ctx.restore();
			}
			else{
				this.#ctx.textBaseline = "top";
				this.#ctx.textAlign = "center";
				this.#ctx.fillText(label, x, this.#paddings["bottom"] + this.#padding);
			}
		}
	}

	#draw_y_axis_line(){
		if(!("y_axis" in this.#data) || this.#data["y_axis"]["label"] !== true) return;

		this.#ctx.beginPath();
		this.#ctx.setLineDash([this.#data["y_axis"]["line_dash"] || 0]);
		this.#ctx.moveTo(this.#paddings.left, this.#paddings.top);
		this.#ctx.lineTo(this.#paddings.left, this.#paddings.bottom);

		this.#ctx.strokeStyle = this.#y_axis_line_color;
		this.#ctx.lineWidth = 1;
		this.#ctx.stroke();
	}

	#draw_y_axis_markers(){
		for(let i = 0; i < this.#marker_count_y_axis; i++){
			this.#ctx.textAlign = "right";
			this.#ctx.fillStyle = this.#y_axis_text_color;
			this.#ctx.font = this.#font;
			this.#ctx.textBaseline = "middle";
			this.#ctx.fillText((this.#max_value - i * this.#y_axis_step_value).toFixed(1), this.#paddings.left - this.#padding, i * this.#gap_y_axis + this.#paddings["top"]);
		}
	}

	#draw_grid_x_lines(){
		if(!("grid" in this.#data)) return;
		if(this.#data["grid"]["x"] !== true) return;

		this.#ctx.strokeStyle = this.#grid_color;
		this.#ctx.lineWidth = this.#grid_line_width;
		this.#ctx.setLineDash([this.#data["grid"]["line_dash"] || 0]);

		for (let i = 0; i < this.#marker_count_y_axis; i++) {
			this.#ctx.beginPath();
			this.#ctx.moveTo(this.#paddings.left - this.#marker_size, this.#gap_y_axis * i + this.#paddings["top"]);
			this.#ctx.lineTo(this.#paddings.right, this.#gap_y_axis * i + this.#paddings["top"]);
			this.#ctx.stroke();
		}
	}

	#draw_grid_y_lines(){
		if(!("grid" in this.#data)) return;
		if(this.#data["grid"]["y"] !== true) return;

		let has_markers = false;
		if(this.#data["x_axis"]["markers"] && this.#data["x_axis"]["markers"].length > 1) has_markers = true;
		const markers_length = has_markers ? this.#data["x_axis"]["markers"].length : this.#longest_dataset;
		const gap_x_axis = has_markers ? (this.#paddings["right"] - this.#paddings["left"]) / (markers_length - 1) : this.#gap_x_axis;

		this.#ctx.strokeStyle = this.#grid_color;
		this.#ctx.lineWidth = this.#grid_line_width;
		this.#ctx.setLineDash([this.#data["grid"]["line_dash"] || 0]);

		for(let i = 0; i < markers_length; i++){
			const x = i * gap_x_axis + this.#paddings["left"];
			this.#ctx.beginPath();
			this.#ctx.moveTo(x, this.#paddings.top);
			this.#ctx.lineTo(x, this.#paddings.bottom + this.#marker_size);
			this.#ctx.stroke();
		}
	}

	#draw_data_lines(){
		let has_markers = false;
		if(this.#data["x_axis"]["markers"] && this.#data["x_axis"]["markers"].length > 1) has_markers = true;
		const markers_length = has_markers ? this.#data["x_axis"]["markers"].length : this.#longest_dataset;
		const gap_x_axis = has_markers ? (this.#paddings["right"] - this.#paddings["left"]) / (markers_length - 1) : this.#gap_x_axis;

		this.#ctx.lineWidth = 2;

		for(let i = 0; i < this.#data["data"].length; i++){
			this.#ctx.beginPath();
			this.#ctx.moveTo(this.#paddings["left"], this.#paddings["bottom"] - (this.#data["data"][i]["values"][0] - this.#min_value) * this.#scale_y);
			this.#ctx.strokeStyle = this.#data["data"][i]["color"];
			this.#ctx.setLineDash([this.#data["data"][i]["line_dash"] || 0]);

			for(let j = 0; j < markers_length; j++){
				this.#ctx.lineTo(
					j * gap_x_axis + this.#paddings["left"],
					this.#paddings["bottom"] - (this.#data["data"][i]["values"][j] - this.#min_value) * this.#scale_y
				);
			}

			this.#ctx.stroke();
		}
	}

	#draw_data_points(){
		if(!("data_points" in this.#data) || this.#data["data_points"] !== true) return;

		let has_markers = false;
		if(this.#data["x_axis"]["markers"] && this.#data["x_axis"]["markers"].length > 1) has_markers = true;
		const markers_length = has_markers ? this.#data["x_axis"]["markers"].length : this.#longest_dataset;
		const gap_x_axis = has_markers ? (this.#paddings["right"] - this.#paddings["left"]) / (markers_length - 1) : this.#gap_x_axis;

		for (let i = 0; i < this.#data["data"].length; i++) {
			const values = this.#data["data"][i]["values"];

			for(let j = 0; j < markers_length; j++){
				const x = j * gap_x_axis + this.#paddings["left"];
				const y = this.#paddings.bottom - (values[j] - this.#min_value) * this.#scale_y;
				this.#ctx.beginPath();
				this.#ctx.fillStyle = this.#data["data"][i]["color"];
				this.#ctx.arc(x, y, this.#circle_rad, 0, Math.PI * 2);
				this.#ctx.fill();
			}
		}
	}

	#draw_data_fill_type_opacity_or_plain(){
		if(!("fill_type" in this.#data)) return;
		if(this.#data["fill_type"] !== "plain" && this.#data["fill_type"] !== "opacity") return;

		let has_markers = false;
		if(this.#data["x_axis"]["markers"] && this.#data["x_axis"]["markers"].length > 1) has_markers = true;
		const markers_length = has_markers ? this.#data["x_axis"]["markers"].length : this.#longest_dataset;
		const gap_x_axis = has_markers ? (this.#paddings["right"] - this.#paddings["left"]) / (markers_length - 1) : this.#gap_x_axis;

		for(const line of this.#data["data"]){
			this.#ctx.beginPath();

			for(let i = 0; i < markers_length; i++){
				this.#ctx.lineTo(
					i * gap_x_axis + this.#paddings["left"],
					this.#paddings.bottom - (line["values"][i] - this.#min_value) * this.#scale_y
				);

				if(i == (markers_length - 1)){
					this.#ctx.lineTo(this.#paddings.right, this.#paddings.bottom);
					this.#ctx.lineTo(this.#paddings.left, this.#paddings.bottom);
					this.#ctx.fillStyle = line["color"];
					this.#ctx.globalAlpha = this.#data["fill_type"] === "plain" ? 1 : 0.1;
					this.#ctx.closePath();
				}
			}
			this.#ctx.fill();
		}
		this.#ctx.globalAlpha = 1;
	}

	#draw_data_fill_type_gradient(){
		if(!("fill_type" in this.#data)) return;
		if(this.#data["fill_type"] !== "gradient") return;

		let has_markers = false;
		if(this.#data["x_axis"]["markers"] && this.#data["x_axis"]["markers"].length > 1) has_markers = true;
		const markers_length = has_markers ? this.#data["x_axis"]["markers"].length : this.#longest_dataset;
		const gap_x_axis = has_markers ? (this.#paddings["right"] - this.#paddings["left"]) / (markers_length - 1) : this.#gap_x_axis;

		this.#ctx.globalAlpha = 0.5;

		for(const line of this.#data["data"]){
			this.#ctx.beginPath();

			const gradient = this.#ctx.createLinearGradient(
				this.#padding,
				this.#paddings.bottom - (Math.max(...line["values"]) - this.#min_value) * this.#scale_y,
				this.#padding,
				this.#paddings.bottom
			);
			gradient.addColorStop(0, line["color"]);
			gradient.addColorStop(1, "rgba(255, 255, 255, 0");
			this.#ctx.fillStyle = gradient;

			for(let i = 0; i < markers_length; i++){

				this.#ctx.lineTo(
					i * gap_x_axis + this.#paddings["left"],
					this.#paddings.bottom - (line["values"][i] - this.#min_value) * this.#scale_y
				);

				if(i == (markers_length - 1)){
					this.#ctx.lineTo(this.#paddings.right, this.#paddings.bottom);
					this.#ctx.lineTo(this.#paddings.left, this.#paddings.bottom);
					this.#ctx.closePath();
				}

			}
			this.#ctx.fill();
		}

		this.#ctx.globalAlpha = 1;
	}

	#draw_legends(){
		if(!("legends" in this.#data) || this.#data["legends"] !== true) return;

		const rect_width = 20;
		const rect_height = 10;
		const gap = 30;
		let start_x = (this.#canvas_DPI_width) / 2;

		this.#ctx.textBaseline = "middle";
		this.#ctx.textAlign = "left";
		this.#ctx.font = this.#font;

		for(let i = 0; i < this.#data["data"].length; i++) start_x -= this.#ctx.measureText(this.#data["data"][i]["label"]).width / 2;

		// Rectangles
		start_x -= this.#data["data"].length * rect_width / 2;

		// Gaps
		start_x -= (this.#data["data"].length - 1) * gap / 2;

		for(let i = 0; i < this.#data["data"].length; i++){
			this.#ctx.fillStyle = this.#data["data"][i]["color"];
			this.#ctx.fillRect(start_x, this.#padding - (rect_height / 2), rect_width, rect_height);
			this.#ctx.fillText(this.#data["data"][i]["label"], start_x + gap, this.#padding);
			start_x += rect_width + this.#ctx.measureText(this.#data["data"][i]["label"]).width + gap;
		}
	}

	#init_on_hover_points(){
		if(this.#data["data_points"] !== true) return;

		this.#canvas.addEventListener('mousemove', (event) => {
			const rect = this.#canvas.getBoundingClientRect();
			const mouseX = event.clientX - rect.left;
			const mouseY = event.clientY - rect.top;

			let hovered_point = null;
			let min_distance = Infinity;

			let has_markers = false;
			if(this.#data["x_axis"]["markers"] && this.#data["x_axis"]["markers"].length > 1) has_markers = true;
			const markers_length = has_markers ? this.#data["x_axis"]["markers"].length : this.#longest_dataset;
			const gap_x_axis = has_markers ? (this.#paddings["right"] - this.#paddings["left"]) / (markers_length - 1) : this.#gap_x_axis;

			for(const line of this.#data["data"]){
				for(let i = 0; i < markers_length; i++){
					const x = i * gap_x_axis + this.#paddings["left"];
					const y = this.#paddings.bottom - (line["values"][i] - this.#min_value) * this.#scale_y;

					// Calculate distance from mouse to point
					const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2));

					// If this point is closer than previous closest point
					if (distance < min_distance && distance < this.#marker_size) {
						min_distance = distance;
						hovered_point = {
							label: line["label"],
							value: line["values"][i],
						};
					}
				}
			}

			if(hovered_point != null) {
				let tooltip_height = this.#tooltip.getBoundingClientRect().height;
				this.#tooltip.style.display = 'block';
				this.#tooltip.style.left = event.pageX + "px";
				this.#tooltip.style.top = event.pageY - tooltip_height - 5 + "px";
				this.#tooltip.textContent = `${hovered_point["label"]}: ${hovered_point["value"].toFixed(0)}`;
			}

			else { this.#tooltip.style.display = 'none'; }
		});
	}
}

window.customElements.define('x-line-chart', Line);

{/* <x-line-chart>
{
	"legends": true,
	"data_points": true,
	"fill_type": "gradient",
	"x_axis": {
		"line": {
			"line_dash": 0,
			"color": "white"
		},
		"marker": {
			"color": "white",
			"markers": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
		}
	},
	"y_axis": {
		"line": {
			"line_dash": 0,
			"color": "white"
		},
		"marker": {
			"color": "white",
			"count": 5
		}
	},
	"grid": {
		"x": true,
		"y": true,
		"line_dash": 10,
		"color": "white"
	},
	"datasets": [
		{
			"label": "A",
			"line_dash": 10,
			"color": "#ef9b20",
			"data": [50, 20, 0, 40, 70, 60, 90, 80, 50, 200, -60, -250, 400]
		},
		{
			"label": "B",
			"line_dash": 0,
			"color": "#27aeef",
			"data": [150, 50, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650]
		},
		{
			"label": "C",
			"line_dash": 0,
			"color": "#b33dc6",
			"data": [-50, 70, 20, 90, 150, 120, 180, 200, 170, 160, 140, 130, 110]
		}
	]
}
</x-line-chart> */}
