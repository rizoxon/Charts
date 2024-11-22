function draw_pie_chart(data, title){
	// let canvas = document.querySelector("canvas");
	// canvas.width = window.innerWidth - 200;
	// canvas.height = window.innerHeight - 200;
	// let ctx = canvas.getContext("2d");

	// Create tooltip
	// let tooltip = document.createElement('div');
	// tooltip.style.position = 'absolute';
	// tooltip.style.display = 'none';
	// tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
	// tooltip.style.color = 'white';
	// tooltip.style.padding = '5px';
	// tooltip.style.borderRadius = '5px';
	// tooltip.style.fontSize = '14px';
	// tooltip.style.pointerEvents = 'none';
	// document.body.appendChild(tooltip);

	// let measure = {
	// 	"x": canvas.width / 2,
	// 	"y": canvas.height / 2,
	// 	"radius": Math.min(canvas.width, canvas.height) / 3,
	// }

	// let total_value = 0;
	// for(const item of data) total_value += item["value"];

	// let start_angle = 0;
	// let slices = [];
	// for(const item of data){
	// 	let slice_angle = (item["value"] / total_value) * 2 * Math.PI;
	// 	slices.push({
	// 		start: start_angle,
	// 		end: start_angle + slice_angle,
	// 		color: item.color,
	// 		label: item.label,
	// 		value: item.value,
	// 		hovered: false
	// 	})
	// 	start_angle += slice_angle;
	// }

	// function draw_slice(slice, is_hovered){
	// 	ctx.beginPath();
	// 	ctx.moveTo(measure.x, measure.y);
	// 	ctx.arc(measure.x, measure.y, measure.radius + (is_hovered ? 20 : 0), slice.start, slice.end);
	// 	ctx.closePath();

	// 	ctx.globalAlpha = is_hovered ? 1 : 0.8;
	// 	ctx.fillStyle = slice.color;
	// 	ctx.fill();

	// 	ctx.globalAlpha = 1;
	// 	ctx.lineWidth = 5;
	// 	ctx.strokeStyle = "#fff";
	// 	ctx.stroke();
	// }

	// function draw_labels() {
	// 	ctx.font = "16px Arial";
	// 	ctx.textAlign = "left";
	// 	ctx.textBaseline = "top";

	// 	let y = 20;
	// 	for (const slice of slices) {
	// 		ctx.fillStyle = slice.color;
	// 		ctx.fillRect(20, y, 20, 16);
	// 		ctx.fillStyle = "#000";
	// 		ctx.fillText(`${slice.label}: ${slice.value}`, 50, y);
	// 		y += 30;
	// 	}
	// }

	// function draw_title() {
	// 	ctx.font = "24px Arial";
	// 	ctx.textAlign = "center";
	// 	ctx.textBaseline = "top";
	// 	ctx.fillText(title, measure.x, 10);
	// }

	function redraw_chart(){
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		for(const slice of slices) draw_slice(slice, slice.hovered);
		draw_labels();
		draw_title();
	}

	canvas.addEventListener("mousemove", event => {
		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left - measure.x;
		const y = event.clientY - rect.top - measure.y;
		const mouse_angle = (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI);
		const distance = Math.sqrt(x * x + y * y);

		let needs_redraw = false;
		let hovered_slice = null;
		for(const slice of slices){
			const is_hovered = distance <= measure.radius && mouse_angle >= slice.start && mouse_angle < slice.end;

			if(slice.hovered !== is_hovered){
				slice.hovered = is_hovered;
				needs_redraw = true;
			}

			if(is_hovered == true) hovered_slice = slice;
		}

		if(hovered_slice != null) {
			let tooltip_height = tooltip.getBoundingClientRect().height;
			tooltip.style.display = 'block';
			tooltip.style.left = event.pageX + 'px';
			tooltip.style.top = event.pageY - tooltip_height - 5 + 'px';
			tooltip.textContent = `${hovered_slice.label}: ${hovered_slice.value}`;
		}else tooltip.style.display = 'none';

		if(needs_redraw) redraw_chart();
	})

	redraw_chart()
}


let pie_data = [
	{"label": "A", "value": 78, "color": "#821131"},
	{"label": "B", "value": 37, "color": "#1E2A5E"},
	{"label": "C", "value": 100, "color": "#0D7C66"}
]
draw_pie_chart(pie_data, "My pie chart title");