const rosas = {};



function injectLoadingMask() {
	document.body.insertAdjacentHTML("beforeend", `
		<div class="loading-mask loading-mask-fading-out" id="loading-mask" style="opacity: 0;">
			<div class="loading-ring" id="loading-mask-loading-ring"></div>
			<div class="loading-mask-error" id="loading-mask-error" hidden>×</div>
			<div class="loading-mask-message" id="loading-mask-message"></div>
		</div>
	`);
}

function injectThemeToggle() {
	let isThemeDark = (sessionStorage.getItem("isThemeDark") ?? "false") === "true";

	document.body.insertAdjacentHTML("beforeend", `<div class="theme-toggle" id="theme-toggle"></div>`);
	const updateTheme = () => {
		if (isThemeDark) {
			document.documentElement.style.setProperty("--color", "#EEE");
			document.documentElement.style.setProperty("--background-color", "#111");
		}
		else {
			document.documentElement.style.setProperty("--color", "#222");
			document.documentElement.style.setProperty("--background-color", "#FFF");
		}
	};
	rosas.themeToggle = document.getElementById("theme-toggle");
	rosas.themeToggle.onclick = () => {
		isThemeDark = !isThemeDark;
		updateTheme();
		sessionStorage.setItem("isThemeDark", isThemeDark);
	};
	updateTheme();
}

function injectToastDisplay() {
	document.body.insertAdjacentHTML("beforeend", `<div class="toast-wrapper"><div class="toast hidden-toast" id="toast-display"><span id="toast-text-span"></span><div class="toast-close-button" id="toast-close-button">×</div></div></div>`);
	rosas.toastDisplay = document.getElementById("toast-display");
	rosas.toastTextSpan = document.getElementById("toast-text-span");
	rosas.toastCloseButton = document.getElementById("toast-close-button");
	rosas.toastCloseButton.addEventListener("click", () => {
		rosas.toastDisplay.classList = "toast hidden-toast";
		clearTimeout(rosas.toastFadeOutTimerId);
	});
}

function injectFieldsetFrame() {}  // TODO: ...

function quoted(string) { return JSON.stringify(string).slice(1, -1); }
function constructCatalogHtml(catalog) {
	let html = `<ul>`;
	for (const catalogName of Object.keys(catalog)) {
		const catalogTarget = catalog[catalogName];
		const quotedCatalogName = quoted(catalogName);
		if (typeof catalogTarget === "string")
			html += `<li><a href="${catalogTarget}" title="${quotedCatalogName}">${quotedCatalogName}</a></li>`;
		else {
			html += `<li><label title="${quotedCatalogName}"><input type="checkbox" hidden/>${quotedCatalogName}</label></li>`;
			html += constructCatalogHtml(catalogTarget);
		}
	}
	html += `</ul>`;
	return html;
}
function filterCatalog(catalogItems, regex) {
	for (const catalogItem of catalogItems)
		if (catalogItem.tagName === "LI")
			catalogItem.hidden = !regex.test(catalogItem.textContent);
		else
			filterCatalog(catalogItem.children, regex);
}
function getCurrentCatalogItem(catalogItems, url) {
	for (const catalogItem of catalogItems)
		if (catalogItem.tagName === "LI") {
			if (catalogItem.children[0].tagName === "A" && url.includes(catalogItem.children[0].href))
				return catalogItem;
		}
		else {
			const targetItem = getCurrentCatalogItem(catalogItem.children, url);
			if (targetItem !== undefined)
				return targetItem;
		}
}
function expandCatalogDirectory(catalogItem) {
	let currentDirectory = catalogItem;
	while (true) {
		currentDirectory = currentDirectory.parentElement.previousElementSibling;
		if (!currentDirectory)
			break;
		currentDirectory.getElementsByTagName("input")[0].checked = true;
	}
}
function highlightCatalogItem(catalogItem) {
	catalogItem.classList.add("actived-catalog-item");
	setTimeout(() => catalogItem.scrollIntoView({block: "center"}), 0);
}
function injectCatalog(catalogJson) {
	let isCatalogOpen = (sessionStorage.getItem("isCatalogOpen") ?? "false") === "true";
	
	const catalogTitle = quoted(Object.keys(catalogJson)[0]);
	const catalogHTML = constructCatalogHtml(catalogJson[catalogTitle]);
	document.body.insertAdjacentHTML("afterbegin", `
		<nav class="catalog-sidebar" id="catalog-sidebar" style="--catalog-sidebar-expansion‌: ${isCatalogOpen ? 1 : 0};">
			<div class="catalog-title">CATALOG</div>
			<div class="catalog-title catalog-subtitle" title="ROSAS Example Catelog">${catalogTitle}</div>
			<input id="catalog-search-input" placeholder="Search catalog here." autocomplete="off"/>
			<div id="catalog-item-list" class="catalog-item-list">
				${catalogHTML}
			</div>
		</nav>
	`);
	document.body.insertAdjacentHTML("beforeend", `<div class="catalog-toggle" id="catalog-toggle"></div>`);
	document.body.insertAdjacentHTML("beforeend", `<div></div>`);
	
	const catalogToggle = document.getElementById("catalog-toggle");
	const catalogSidebar = document.getElementById("catalog-sidebar");
	const catalogSearchInput = document.getElementById("catalog-search-input");
	const catalogItemList = document.getElementById("catalog-item-list");
	
	catalogToggle.addEventListener("click", () => {
		catalogSidebar.style.setProperty("--catalog-sidebar-expansion‌", isCatalogOpen ? 0 : 1);
		isCatalogOpen = !isCatalogOpen;
		sessionStorage.setItem("isCatalogOpen", isCatalogOpen);
	});
	catalogSearchInput.addEventListener("input", () => {
		try {
			catalogSearchInput.classList.toggle(
				"searching-catalog-search-input",
				catalogSearchInput.value !== ""
			);
			filterCatalog(catalogItemList.children, RegExp(catalogSearchInput.value, "i"));
		}
		catch (error) { showErrorToast("Invalid regular expression."); }
	});

	const currentCatalogItem = getCurrentCatalogItem(catalogItemList.children, window.location.href);
	expandCatalogDirectory(currentCatalogItem);
	highlightCatalogItem(currentCatalogItem);
}



function bindValuesOneWay(from, to, store = value => {}) {
	from.addEventListener("input", (event) => {
		let value = event.target.value;
		to.value = value;
		store(value);
	});
}
function bindValues(from, to, store = value => {}) {
	bindValuesOneWay(from, to, store);
	bindValuesOneWay(to, from, store);
}



function updateLoadingMessage(message = null) {
	if (message == null)
		return;
	let loadingMaskMessage = document.getElementById("loading-mask-message");
	loadingMaskMessage.innerText = message;
}
function startLoading(message = null) {
	document.addEventListener("DOMContentLoaded", () => {
		let loadingMask = document.getElementById("loading-mask");
		loadingMask.style.opacity = 1;
		loadingMask.classList.remove("loading-mask-fading-out");
		updateLoadingMessage(message);
	});
}
function endLoading() {
	let loadingMask = document.getElementById("loading-mask");
	loadingMask.classList.add("loading-mask-fading-out");
}
function failLoading(message = null) {
	let loadingMaskLoadingRing = document.getElementById("loading-mask-loading-ring");
	let loadingMaskError = document.getElementById("loading-mask-error");
	loadingMaskLoadingRing.hidden = true;
	loadingMaskError.hidden = false;
	updateLoadingMessage(message);
}



document.addEventListener("DOMContentLoaded", () => {
	injectLoadingMask();
	injectThemeToggle();
	injectToastDisplay();
	injectFieldsetFrame();
	console.log("Welcome to use ROSAS! For more information, please visit https://github.com/redstone-heart/rosas.");  // TODO: ...
});



function showToast(message, status = "default") {
	rosas.toastDisplay.classList = `toast ${status}-toast`;
	rosas.toastTextSpan.textContent = message;
	clearTimeout(rosas.toastFadeOutTimerId);
	rosas.toastFadeOutTimerId = setTimeout(() => {
		rosas.toastDisplay.classList = "toast hidden-toast";
	}, 4000);
}
function showInformationToast(message) { showToast(message, "information"); }
function showSuccessToast(message) { showToast(message, "success"); }
function showWarningToast(message) { showToast(message, "warning"); }
function showErrorToast(message) { showToast(message, "error"); }

function writeCode(code, tabLength = 4, stripEmptyLines = true, stripCommonIndent = true) {
	if (stripEmptyLines)
		code = code.replace(/^(\s*\n)+|(\n\s*)+$/g, "");
	code = code.replaceAll("\t", " ".repeat(tabLength));
	if (stripCommonIndent) {
		let commonIndentCount = Infinity;
		for (const line of code.split("\n")) {
			let indentCount = 0;
			for (const char of line)
				if (char === " ")
					++indentCount;
				else
					break;
			if (indentCount < commonIndentCount)
				commonIndentCount = indentCount;
		}
		if (commonIndentCount != Infinity)
			code = code.replace(new RegExp(`^ {${commonIndentCount}}`, "gm"), "");
	}
	const codeElement = document.currentScript.parentElement;
	codeElement.textContent = code;
	const preprocessedCode = codeElement.innerHTML;
	codeElement.innerHTML = preprocessedCode.replaceAll(" ", "&nbsp;").replaceAll("\n", "<br>");
}

// TODO: function fromMarkdown() {}
