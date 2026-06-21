let timezones = [
    "UTC",
    "America/New_York",
    "Europe/London",
    "Asia/Tokyo",
    "Australia/Sydney"
];

function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
}

function formatDate(date) {
    return date.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function updateClocks() {
    const grid = document.getElementById("clocksGrid");
    grid.innerHTML = "";

    timezones.forEach(tz => {
        const date = new Date(
            new Date().toLocaleString("en-US", {
                timeZone: tz
            })
        );

        const card = document.createElement("div");
        card.className = "clock-card";

        card.innerHTML = `
            <div class="timezone-name">${tz}</div>
            <div class="time-display">${formatTime(date)}</div>
            <div class="date-display">${formatDate(date)}</div>
            <button
                onclick="removeTimezone('${tz}')"
                style="margin-top:15px;padding:8px 15px;background:#ff6b6b;color:white;border:none;border-radius:5px;">
                Remove
            </button>
        `;

        grid.appendChild(card);
    });
}

function addTimezone() {
    const input = document.getElementById("tzInput");
    const tz = input.value.trim();

    if (!tz) {
        alert("Please enter a time zone");
        return;
    }

    if (timezones.includes(tz)) {
        alert("This time zone is already added");
        return;
    }

    try {
        new Date().toLocaleString("en-US", {
            timeZone: tz
        });

        timezones.push(tz);
        input.value = "";
        updateClocks();
    } catch {
        alert("Invalid time zone");
    }
}

function removeTimezone(tz) {
    timezones = timezones.filter(t => t !== tz);
    updateClocks();
}

updateClocks();
setInterval(updateClocks, 1000);

document.getElementById("tzInput").addEventListener("keypress", e => {
    if (e.key === "Enter") {
        addTimezone();
    }
});
