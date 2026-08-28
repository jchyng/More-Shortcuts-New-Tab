function setupSearch() {
  const input = document.getElementById("searchInput");
  const suggestionsList = document.getElementById("searchSuggestions");
  const searchBar = document.getElementById("searchBar");
  let debounceTimeout;

  input.addEventListener("input", (e) => {
    const query = input.value.trim();

    clearTimeout(debounceTimeout);

    if (!query) {
      hideSuggestions();
      return;
    }

    debounceTimeout = setTimeout(() => {
      fetchSuggestions(query);
    }, 150); // debounce to avoid too many API calls
  });

  let selectedIndex = -1;
  let originalInput = "";

  input.addEventListener("keydown", (e) => {
    if (suggestionsList.classList.contains("show")) {
      const items = suggestionsList.querySelectorAll(".suggestion-item");
      if (items.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (selectedIndex === -1) {
            originalInput = input.value;
          }
          selectedIndex = selectedIndex + 1;
          if (selectedIndex >= items.length) {
            selectedIndex = -1;
          }
          updateSelection(items, true);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          if (selectedIndex === -1) {
            originalInput = input.value;
            selectedIndex = items.length - 1;
          } else {
            selectedIndex = selectedIndex - 1;
          }
          updateSelection(items, true);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < items.length) {
            const suggestion = items[selectedIndex].querySelector("span:last-child").textContent;
            input.value = suggestion;
            chrome.search.query({ text: suggestion });
            hideSuggestions();
          } else {
            const query = input.value.trim();
            if (query) {
              chrome.search.query({ text: query });
            }
          }
        }
      }
    } else if (e.key === "Enter") {
      const query = input.value.trim();
      if (query) {
        chrome.search.query({ text: query });
      }
    }
  });

  function updateSelection(items, updateInput = false) {
    items.forEach((item, index) => {
      if (index === selectedIndex) {
        item.classList.add("selected");
        if (updateInput) {
          input.value = item.querySelector("span:last-child").textContent;
        }
      } else {
        item.classList.remove("selected");
      }
    });

    if (selectedIndex === -1 && updateInput) {
      input.value = originalInput;
    }
  }

  async function fetchSuggestions(query) {
    try {
      const response = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();

      const suggestions = data[1] || [];
      renderSuggestions(suggestions);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      hideSuggestions();
    }
  }

  function renderSuggestions(suggestions) {
    suggestionsList.innerHTML = '';
    selectedIndex = -1; // Reset selection on new suggestions

    if (suggestions.length === 0) {
      hideSuggestions();
      return;
    }

    suggestions.slice(0, 8).forEach((suggestion, index) => {
      const li = document.createElement('li');
      li.className = 'suggestion-item';

      const iconSpan = document.createElement('span');
      iconSpan.className = 'material-icons';
      iconSpan.textContent = 'search';

      const textSpan = document.createElement('span');
      textSpan.textContent = suggestion;

      li.appendChild(iconSpan);
      li.appendChild(textSpan);

      li.addEventListener('click', () => {
        input.value = suggestion;
        chrome.search.query({ text: suggestion });
        hideSuggestions();
      });

      li.addEventListener('mouseenter', () => {
        selectedIndex = index;
        updateSelection(suggestionsList.querySelectorAll(".suggestion-item"), false);
      });

      suggestionsList.appendChild(li);
    });

    showSuggestions();
  }

  function showSuggestions() {
    suggestionsList.classList.add('show');
    searchBar.classList.add('has-suggestions');
  }

  function hideSuggestions() {
    suggestionsList.classList.remove('show');
    searchBar.classList.remove('has-suggestions');
  }

  document.addEventListener("click", (e) => {
    if (!searchBar.contains(e.target)) {
      hideSuggestions();
    }
  });

  input.addEventListener("focus", () => {
    if (input.value.trim() && suggestionsList.children.length > 0) {
      showSuggestions();
    }
  });

  document.getElementById("imageSearchBtn").addEventListener("click", () => {
    window.location.href = "https://lens.google.com/";
  });
  document.getElementById("aiModeBtn").addEventListener("click", () => {
    window.location.href =
      "https://www.google.com/search?sourceid=chrome&udm=50&aep=42";
  });
}
