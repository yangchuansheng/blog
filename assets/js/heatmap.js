// 获取最近一年的文章数据
{{ $pages := where .Site.RegularPages "Date" ">" (now.AddDate -1 0 0) }}
{{ $pages := $pages.Reverse }}
var blogInfo = {
    "pages": [
        {{ range $index, $element := $pages }}
            {
                "title": "{{ .Title }}",
                "date": "{{ .Date.Format "2006-01-02" }}",
                "year": "{{ .Date.Format "2006" }}",
                "month": "{{ .Date.Format "01" }}",
                "day": "{{ .Date.Format "02" }}",
                "word_count": "{{ .WordCount }}"
            }{{ if ne (add $index 1) (len $pages) }},{{ end }}
            {{ end }}
    ]
};
// console.log(blogInfo)

let currentDate = new Date();
currentDate.setFullYear(currentDate.getFullYear() - 1);

let startDate;

let monthDiv = document.querySelector('.month');
let monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

if (window.innerWidth < 768) {
    numMonths = 6;
} else {
    numMonths = 12;
}

let startMonthIndex = (currentDate.getMonth() - (numMonths - 1) + 12) % 12;
for (let i = startMonthIndex; i < startMonthIndex + numMonths; i++) {
    let monthSpan = document.createElement('span');
    let monthIndex = i % 12;
    monthSpan.textContent = monthNames[monthIndex];
    monthDiv.appendChild(monthSpan);
}

function getStartDate() {
    const today = new Date();

    if (window.innerWidth < 768) {
        numMonths = 6;
    } else {
        numMonths = 12;
    }

    const startDate = new Date(today.getFullYear(), today.getMonth() - numMonths + 1, 1, today.getHours(), today.getMinutes(), today.getSeconds());

    while (startDate.getDay() !== 1) {
        startDate.setDate(startDate.getDate() + 1);
    }

    return startDate;
}

function getWeekDay(date) {
    const day = date.getDay();
    return day === 0 ? 6 : day - 1;
}

function createDay(date, title, count, post) {
    const day = document.createElement("div");

    day.className = "heatmap_day";

    day.setAttribute("data-title", title);
    day.setAttribute("data-count", count);
    day.setAttribute("data-post", post);
    day.setAttribute("data-date", date);

    day.addEventListener("mouseenter", function () {
        const tooltip = document.createElement("div");
        tooltip.className = "heatmap_tooltip";

        let tooltipContent = "";

        if (post && parseInt(post, 10) !== 0) {
            tooltipContent += '<span class="heatmap_tooltip_post">' + '共 ' + post + ' 篇' + '</span>';
        }

        if (count && parseInt(count, 10) !== 0) {
            tooltipContent += '<span class="heatmap_tooltip_count">' + ' ' + count + ' 字；' + '</span>';
        }

        if (title && parseInt(title, 10) !== 0) {
            tooltipContent += '<span class="heatmap_tooltip_title">' + title + '</span>';
        }

        if (date) {
            tooltipContent += '<span class="heatmap_tooltip_date">' + date + '</span>';
        }

        tooltip.innerHTML = tooltipContent;
        day.appendChild(tooltip);
    });

    day.addEventListener("mouseleave", function () {
        const tooltip = day.querySelector(".heatmap_tooltip");
        if (tooltip) {
            day.removeChild(tooltip);
        }
    });

    if (count == 0 ) {
        day.classList.add("heatmap_day_level_0");
    } else if (count > 0 && count < 1000) {
        day.classList.add("heatmap_day_level_1");
    } else if (count >= 1000 && count < 2000) {
        day.classList.add("heatmap_day_level_2");
    } else if (count >= 2000 && count < 3000) {
        day.classList.add("heatmap_day_level_3");
    } else {
        day.classList.add("heatmap_day_level_4");
    }

    return day;
}

function createWeek() {
    const week = document.createElement('div');
    week.className = 'heatmap_week';
    return week;
}

function createHeatmap() {
    const container = document.getElementById('heatmap');
    const startDate = getStartDate();
    const endDate = new Date();
    const weekDay = getWeekDay(startDate);

    let currentWeek = createWeek();
    container.appendChild(currentWeek);

    let currentDate = startDate;
    let i = 0;

    while (currentDate <= endDate) {
        if (i % 7 === 0 && i !== 0) {
            currentWeek = createWeek();
            container.appendChild(currentWeek);
        }

        const dateString = `${currentDate.getFullYear()}-${("0" + (currentDate.getMonth()+1)).slice(-2)}-${("0" + (currentDate.getDate())).slice(-2)}`;

        const articleDataList = blogInfo.pages.filter(page => page.date === dateString);

        if (articleDataList.length > 0) {
            const titles = articleDataList.map(data => data.title);
            const title = titles.map(t => `《${t}》`).join('<br />');

            let count = 0;
            let post = articleDataList.length;

            articleDataList.forEach(data => {
                count += parseInt(data.word_count, 10);
            });

            const formattedDate = formatDate(currentDate);
            const day = createDay(formattedDate, title, count, post);
            currentWeek.appendChild(day);
        } else {
            const formattedDate = formatDate(currentDate);
            const day = createDay(formattedDate, '', '0', '0');
            currentWeek.appendChild(day);
        }

        i++;
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

function formatDate(date) {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

createHeatmap();