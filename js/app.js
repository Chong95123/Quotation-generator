let activeUserId = null;
const FAVORITES_STORAGE_PREFIX = "quotation-system-favorites:";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await checkUser();

  if (user) {
    showApp(user);
    loadCompanyProfile();
  } else {
    showAuth();
  }

  // ===== Auth form switching =====
  document.getElementById("show-register")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("login-form").classList.add("hidden");
    document.getElementById("register-form").classList.remove("hidden");
  });

  document.getElementById("show-login")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("register-form").classList.add("hidden");
    document.getElementById("login-form").classList.remove("hidden");
  });

  // Login
  document.getElementById("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const user = await login(email, password);
    if (user) {
      showApp(user);
      loadCompanyProfile();
    }
  });

  // Register
  document.getElementById("register-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = document.getElementById("register-name").value;
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;

    const user = await register(email, password, fullName);
    if (user) {
      alert("Registration successful! You can now login.");
      document.getElementById("register-form").classList.add("hidden");
      document.getElementById("login-form").classList.remove("hidden");
    }
  });

  // Logout
  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    await logout();
  });

  // ===== Navigation =====
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const page = item.dataset.page;

      document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
      item.classList.add("active");

      document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
      document.getElementById(`page-${page}`).classList.remove("hidden");

      // Load projects when opening Projects page
      if (page === "projects") {
        loadProjects();
      }
      if (page === "dashboard") {
        loadDashboardStats();
      }
      if (page === "favourites") {
        loadFavourites();
      }
    });
  });

  // ===== Company form =====
  document.getElementById("company-logo")?.addEventListener("change", function () {
    previewImage(this, "logo-preview");
  });
  document.getElementById("company-chop")?.addEventListener("change", function () {
    previewImage(this, "chop-preview");
  });
  document.getElementById("company-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveCompanyProfile();
  });

  // ===== Project form =====
  document.getElementById("btn-new-project")?.addEventListener("click", () => {
    openProjectForm();
  });

  document.getElementById("btn-cancel-project")?.addEventListener("click", () => {
    closeProjectForm();
  });

  document.getElementById("project-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveProject();
  });
});

function showApp(user) {
  activeUserId = user.id;
  document.getElementById("auth-page").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("current-user-email").textContent = user.email;
  refreshFavoritePickers();
  loadDashboardStats();
}

async function loadDashboardStats() {
  if (!activeUserId) return;

  const projectCountEl = document.getElementById("dashboard-total-projects");
  const pendingCountEl = document.getElementById("dashboard-pending-quotations");
  const approvedCountEl = document.getElementById("dashboard-approved-this-month");
  if (!projectCountEl || !pendingCountEl || !approvedCountEl) return;

  // Use the user's local calendar month for the approved count.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const [projectsResult, pendingResult, approvedResult] = await Promise.all([
    supabaseClient
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", activeUserId),
    supabaseClient
      .from("quotations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", activeUserId)
      .in("status", ["draft", "adjusting"]),
    supabaseClient
      .from("quotations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", activeUserId)
      .eq("status", "approved")
      .gte("approved_at", monthStart)
      .lt("approved_at", nextMonthStart)
  ]);

  [
    [projectsResult, projectCountEl, "projects"],
    [pendingResult, pendingCountEl, "pending quotations"],
    [approvedResult, approvedCountEl, "approved quotations"]
  ].forEach(([result, element, label]) => {
    if (result.error) {
      console.error(`Failed to load ${label} dashboard count:`, result.error);
      element.textContent = "—";
    } else {
      element.textContent = String(result.count || 0);
    }
  });
}

function showAuth() {
  document.getElementById("auth-page").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
}

function favoriteStorageKey() {
  return activeUserId ? FAVORITES_STORAGE_PREFIX + activeUserId : null;
}

function getFavorites() {
  const key = favoriteStorageKey();
  if (!key) return [];
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch (error) {
    console.error("Could not read favourites:", error);
    return [];
  }
}

function saveFavorites(favorites) {
  const key = favoriteStorageKey();
  if (!key) return alert("Please sign in to use Favourites.");
  try {
    localStorage.setItem(key, JSON.stringify(favorites));
    refreshFavoritePickers();
    loadFavourites();
  } catch (error) {
    console.error("Could not save favourites:", error);
    alert("Could not save favourites in this browser.");
  }
}

function refreshFavoritePickers() {
  const favorites = getFavorites();
  ["quotation-favourite-picker", "vo-favourite-picker"].forEach(id => {
    const picker = document.getElementById(id);
    if (!picker) return;
    const selected = picker.value;
    picker.replaceChildren(new Option("Choose a favourite line", ""));
    favorites.forEach(favorite => {
      const option = new Option(favorite.name || favorite.item_name || "Saved line", favorite.id);
      picker.add(option);
    });
    if (favorites.some(favorite => favorite.id === selected)) picker.value = selected;
  });
}

function loadFavourites() {
  const list = document.getElementById("favourites-list");
  if (!list) return;
  const favorites = getFavorites();
  list.replaceChildren();
  refreshFavoritePickers();

  if (!favorites.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No saved lines yet. Use the ☆ button beside any quotation or VO line to save one.";
    list.appendChild(empty);
    return;
  }

  favorites.forEach(favorite => {
    const card = document.createElement("article");
    card.className = "favourite-card";
    const title = document.createElement("h3");
    title.textContent = favorite.name || favorite.item_name || "Saved line";
    const section = document.createElement("p");
    section.textContent = `Section: ${favorite.section || "General"}`;
    const description = document.createElement("p");
    description.textContent = favorite.description || favorite.item_name || "No description";
    const details = document.createElement("p");
    details.textContent = `${favorite.quantity ?? 1} ${favorite.unit || "pcs"} · Unit price RM ${Number(favorite.unit_price || 0).toFixed(2)}`;
    const actions = document.createElement("div");
    actions.className = "favourite-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn-secondary";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => openFavoriteEditor(card, favorite));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn-delete";
    deleteButton.textContent = "Remove";
    deleteButton.addEventListener("click", () => {
      if (!confirm(`Remove “${favorite.name || favorite.item_name}” from Favourites?`)) return;
      saveFavorites(getFavorites().filter(item => item.id !== favorite.id));
    });

    actions.append(editButton, deleteButton);
    card.append(title, section, description, details, actions);
    list.appendChild(card);
  });
}

function openFavoriteEditor(card, favorite) {
  card.replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = "Edit favourite line";
  const form = document.createElement("form");
  form.className = "favourite-edit-form";

  const addField = (labelText, key, type = "text") => {
    const label = document.createElement("label");
    label.className = "favourite-edit-field";
    label.textContent = labelText;
    const input = type === "textarea" ? document.createElement("textarea") : document.createElement("input");
    if (type !== "textarea") input.type = type;
    input.name = key;
    input.value = favorite[key] ?? "";
    if (type === "number") {
      input.min = "0";
      input.step = "0.01";
    }
    label.appendChild(input);
    form.appendChild(label);
  };

  addField("Favourite name", "name");
  addField("Section", "section");
  addField("Item name", "item_name");
  addField("Description", "description", "textarea");
  addField("Unit", "unit");
  addField("Quantity", "quantity", "number");
  addField("Unit cost", "unit_cost", "number");
  addField("Unit price", "unit_price", "number");

  const changeTypeLabel = document.createElement("label");
  changeTypeLabel.className = "favourite-edit-field";
  changeTypeLabel.textContent = "VO change type";
  const changeType = document.createElement("select");
  changeType.name = "change_type";
  [["add", "Add"], ["change", "Change"], ["omit", "Omit"]].forEach(([value, text]) => {
    const option = new Option(text, value);
    option.selected = (favorite.change_type || "add") === value;
    changeType.add(option);
  });
  changeTypeLabel.appendChild(changeType);
  form.appendChild(changeTypeLabel);

  const actions = document.createElement("div");
  actions.className = "favourite-actions";
  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "btn-primary";
  saveButton.textContent = "Save changes";
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "btn-secondary";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", loadFavourites);
  actions.append(saveButton, cancelButton);
  form.appendChild(actions);

  form.addEventListener("submit", event => {
    event.preventDefault();
    const value = name => form.elements.namedItem(name).value.trim();
    const name = value("name");
    const itemName = value("item_name");
    const description = value("description");
    if (!name || (!itemName && !description)) {
      alert("Enter a favourite name and an item name or description.");
      return;
    }

    const updated = {
      ...favorite,
      name,
      section: value("section"),
      item_name: itemName,
      description,
      unit: value("unit") || "pcs",
      quantity: Number(value("quantity")) || 0,
      unit_cost: Number(value("unit_cost")) || 0,
      unit_price: Number(value("unit_price")) || 0,
      change_type: form.elements.namedItem("change_type").value
    };
    saveFavorites(getFavorites().map(item => item.id === favorite.id ? updated : item));
  });

  card.append(heading, form);
}

function saveFavoriteFromRow(type, row) {
  const value = selector => row.querySelector(selector)?.value?.trim() || "";
  const item = type === "vo" ? {
    section: value(".vo-section"),
    item_name: value(".vo-item-name"),
    description: value(".vo-desc"),
    unit: value(".vo-unit") || "pcs",
    quantity: Number(value(".vo-qty")) || 1,
    unit_price: Number(value(".vo-price")) || 0,
    unit_cost: 0,
    change_type: row.querySelector(".vo-change-type")?.value || "add"
  } : {
    section: value(".item-section"),
    item_name: value(".item-name"),
    description: value(".item-desc"),
    unit: value(".item-unit") || "pcs",
    quantity: Number(value(".item-qty")) || 1,
    unit_cost: Number(value(".item-cost")) || 0,
    unit_price: Number(value(".item-price")) || 0,
    change_type: "add"
  };

  if (!item.item_name && !item.description) return alert("Enter an item name or description before saving this line.");
  const suggestedName = item.item_name || item.description.slice(0, 50);
  const name = prompt("Save this line as a favourite:", suggestedName);
  if (name === null || !name.trim()) return;
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  saveFavorites([...getFavorites(), { ...item, id, name: name.trim() }]);
}

function insertSelectedFavorite(type) {
  const pickerId = type === "vo" ? "vo-favourite-picker" : "quotation-favourite-picker";
  const favoriteId = document.getElementById(pickerId)?.value;
  const favorite = getFavorites().find(item => item.id === favoriteId);
  if (!favorite) return alert("Choose a favourite line first.");

  if (type === "vo") {
    addVoItemRow({ ...favorite, change_type: favorite.change_type || "add" });
    updateVoTotal();
  } else {
    addItemRow(favorite);
    updateQuotationTotal();
  }
}

function previewImage(input, previewId) {
  const preview = document.getElementById(previewId);
  preview.innerHTML = "";
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = document.createElement("img");
      img.src = e.target.result;
      preview.appendChild(img);
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// ====================== COMPANY PROFILE ======================
async function loadCompanyProfile() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data, error } = await supabaseClient
    .from("companies")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Load company error:", error);
    return;
  }

  if (data) {
    document.getElementById("company-name").value = data.company_name || "";
    document.getElementById("company-ssm").value = data.ssm_no || "";
    document.getElementById("company-address").value = data.address || "";
    document.getElementById("company-phone").value = data.phone || "";
    document.getElementById("company-email").value = data.email || "";
    document.getElementById("company-colour").value = data.primary_colour || "#2563eb";
    document.getElementById("company-prepared-by").value = data.prepared_by || "";
    document.getElementById("company-account-holder").value = data.account_holder || "";
    document.getElementById("company-account-handler").value = data.account_handler || "";
    document.getElementById("company-account-number").value = data.account_number  || "";

    document.getElementById("logo-preview").innerHTML = "";
    document.getElementById("chop-preview").innerHTML = "";

    if (data.logo_url) {
      document.getElementById("logo-preview").innerHTML = `
        <img src="${data.logo_url}" style="max-width:120px; max-height:80px; border-radius:8px;" />
      `;
    }
    if (data.chop_url) {
      document.getElementById("chop-preview").innerHTML = `
        <img src="${data.chop_url}" style="max-width:120px; max-height:80px; border-radius:8px;" />
      `;
    }
  }
}

async function saveCompanyProfile() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return alert("Please login first");

  const companyName = document.getElementById("company-name").value.trim();
  if (!companyName) return alert("Company Name is required");

  let logoUrl = null;
  let chopUrl = null;

  const logoFile = document.getElementById("company-logo").files[0];
  const chopFile = document.getElementById("company-chop").files[0];

  // Important: change "company-files" to your real bucket name if different
  if (logoFile) {
    logoUrl = await uploadFile(logoFile, "company-files", user.id);
  }
  if (chopFile) {
    chopUrl = await uploadFile(chopFile, "company-files", user.id);
  }

  const { data: existing } = await supabaseClient
    .from("companies")
    .select("id, logo_url, chop_url")
    .eq("user_id", user.id)
    .single();

  const payload = {
    user_id: user.id,
    company_name: companyName,
    ssm_no: document.getElementById("company-ssm").value.trim(),
    address: document.getElementById("company-address").value.trim(),
    phone: document.getElementById("company-phone").value.trim(),
    email: document.getElementById("company-email").value.trim(),
    primary_colour: document.getElementById("company-colour").value,
    prepared_by: document.getElementById("company-prepared-by").value.trim(),
    updated_at: new Date().toISOString(),
    account_holder: document.getElementById("company-account-holder").value.trim(),
    account_handler: document.getElementById("company-account-handler").value.trim(),
    account_number: document.getElementById("company-account-number").value.trim(),
  };

  if (logoUrl) payload.logo_url = logoUrl;
  else if (existing?.logo_url) payload.logo_url = existing.logo_url;

  if (chopUrl) payload.chop_url = chopUrl;
  else if (existing?.chop_url) payload.chop_url = existing.chop_url;

  let result;
  if (existing) {
    result = await supabaseClient.from("companies").update(payload).eq("user_id", user.id);
  } else {
    result = await supabaseClient.from("companies").insert([payload]);
  }

  if (result.error) {
    console.error(result.error);
    alert("Save failed: " + result.error.message);
  } else {
    alert("Company Profile saved successfully!");
    loadCompanyProfile();
  }
}

async function uploadFile(file, bucket, userId) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;

  const { error } = await supabaseClient
    .storage
    .from(bucket)
    .upload(fileName, file, { upsert: true });

  if (error) {
    console.error("Upload error:", error);
    alert("Upload failed: " + error.message);
    return null;
  }

  const { data } = supabaseClient.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
}

// ====================== PROJECTS ======================

function openProjectForm(project = null) {
  const container = document.getElementById("project-form-container");
  container.classList.remove("hidden");

  if (project) {
    document.getElementById("project-form-title").textContent = "Edit Project";
    document.getElementById("project-id").value = project.id;
    document.getElementById("project-name").value = project.project_name || "";
    document.getElementById("client-name").value = project.client_name || "";
    document.getElementById("client-phone").value = project.client_phone || "";
    document.getElementById("client-email").value = project.client_email || "";
    document.getElementById("client-address").value = project.client_address || "";
    document.getElementById("start-date").value = project.start_date || "";
    document.getElementById("due-date").value = project.due_date || "";
    document.getElementById("project-notes").value = project.notes || "";
  } else {
    document.getElementById("project-form-title").textContent = "Create New Project";
    document.getElementById("project-form").reset();
    document.getElementById("project-id").value = "";
  }

  container.scrollIntoView({ behavior: "smooth" });
}

function closeProjectForm() {
  document.getElementById("project-form-container").classList.add("hidden");
  document.getElementById("project-form").reset();
}

async function saveProject() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return alert("Please login first");

  const projectId = document.getElementById("project-id").value;
  const payload = {
    user_id: user.id,
    project_name: document.getElementById("project-name").value.trim(),
    client_name: document.getElementById("client-name").value.trim(),
    client_phone: document.getElementById("client-phone").value.trim(),
    client_email: document.getElementById("client-email").value.trim(),
    client_address: document.getElementById("client-address").value.trim(),
    start_date: document.getElementById("start-date").value || null,
    due_date: document.getElementById("due-date").value || null,
    notes: document.getElementById("project-notes").value.trim(),
    updated_at: new Date().toISOString()
  };

  if (!payload.project_name || !payload.client_name) {
    return alert("Project Name and Client Name are required");
  }

  let result;
  if (projectId) {
    // Update
    result = await supabaseClient
      .from("projects")
      .update(payload)
      .eq("id", projectId);
  } else {
    // Insert
    result = await supabaseClient
      .from("projects")
      .insert([payload]);
  }

  if (result.error) {
    console.error(result.error);
    alert("Save failed: " + result.error.message);
  } else {
    alert(projectId ? "Project updated!" : "Project created!");
    closeProjectForm();
    loadProjects();
  }
}

async function loadProjects() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data, error } = await supabaseClient
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const list = document.getElementById("projects-list");

  if (error) {
    console.error(error);
    list.innerHTML = `<div class="empty-state">Error loading projects</div>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>No projects yet.</p>
        <p>Click "+ New Project" to create your first one.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = data.map(project => `
  <div class="project-card" onclick="openProjectDetail('${project.id}')">
    <div class="project-info">
      <h3>${project.project_name}</h3>
      <p><strong>Client:</strong> ${project.client_name}</p>
      <p>${project.client_phone || ""} ${project.client_email ? "• " + project.client_email : ""}</p>
      <span class="project-status status-${project.status}">${project.status}</span>
    </div>
    <div class="project-actions" onclick="event.stopPropagation()">
      <button class="btn-edit" onclick="editProject('${project.id}')">Edit</button>
      <button class="btn-delete" onclick="deleteProject('${project.id}')">Delete</button>
    </div>
  </div>
`).join("");
}

async function editProject(id) {
  const { data, error } = await supabaseClient
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    alert("Failed to load project");
    return;
  }
  openProjectForm(data);
}

async function deleteProject(id) {
  if (!confirm("Are you sure you want to delete this project?")) return;

  const { error } = await supabaseClient
    .from("projects")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Delete failed: " + error.message);
  } else {
    loadProjects();
  }
}

// ====================== PROJECT DETAIL + QUOTATION ======================

let currentProjectId = null;
let currentQuotationId = null;

async function generateQuotationNumber() {
  // Format: QU100001, QU100002...
  const { data, error } = await supabaseClient
    .from("quotations")
    .select("quotation_no")
    .like("quotation_no", "QU%")
    .order("quotation_no", { ascending: false })
    .limit(1);

  let nextNumber = 100001;

  if (data && data.length > 0 && data[0].quotation_no) {
    const lastNo = data[0].quotation_no.replace("QU", "");
    const lastNum = parseInt(lastNo);
    if (!isNaN(lastNum)) nextNumber = lastNum + 1;
  }

  return `QU${nextNumber}`;
}

async function openProjectDetail(projectId) {
  currentProjectId = projectId;

  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById("page-project-detail").classList.remove("hidden");

  const { data: project, error } = await supabaseClient
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error) {
    alert("Failed to load project");
    return;
  }

  document.getElementById("detail-project-name").textContent = project.project_name;
  document.getElementById("detail-client-info").textContent = 
    `${project.client_name} ${project.client_phone ? "• " + project.client_phone : ""}`;

  // Always reload both lists
  await loadQuotations(projectId);
  await loadVos(projectId);
  await updateContractSummary(projectId);
}

document.getElementById("btn-back-projects")?.addEventListener("click", () => {
  document.getElementById("page-project-detail").classList.add("hidden");
  document.getElementById("page-projects").classList.remove("hidden");
  // Update sidebar active
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.querySelector('[data-page="projects"]').classList.add("active");
});

document.getElementById("btn-new-quotation")?.addEventListener("click", () => {
  openQuotationForm();
});

document.getElementById("btn-cancel-quotation")?.addEventListener("click", () => {
  closeQuotationForm();
});

document.getElementById("btn-add-item")?.addEventListener("click", () => {
  addItemRow();
});

document.getElementById("btn-replace-all-quotation-text")?.addEventListener("click", replaceAllQuotationText);
document.getElementById("btn-insert-quotation-favourite")?.addEventListener("click", () => insertSelectedFavorite("quotation"));

document.getElementById("btn-save-quotation")?.addEventListener("click", async () => {
  await saveQuotation();
  // After loadQuotations and loadVos
await updateContractSummary(currentProjectId);
});

function openQuotationForm() {
  currentQuotationId = null;
  document.getElementById("quotation-form-container").classList.remove("hidden");
  document.getElementById("quotation-form-title").textContent = "New Quotation";
  document.getElementById("quotation-notes").value = "";
  
  // Clear items
  document.getElementById("items-body").innerHTML = "";
  addItemRow();
  updateQuotationTotal();
}

function closeQuotationForm() {
  document.getElementById("quotation-form-container").classList.add("hidden");
}

function addItemRow(item = null) {
  const tbody = document.getElementById("items-body");
  const tr = document.createElement("tr");
  tr.dataset.isNew = item ? "false" : "true";

  tr.innerHTML = `
    <td class="line-marker-cell"><span class="line-number"></span><span class="line-indicators"></span></td>
    <td>
      <input type="text" class="item-section" value="${item?.section || ""}" placeholder="e.g. Kitchen / Living" />
    </td>
    <td>
      <input type="text" class="item-name" value="${item?.item_name || ""}" placeholder="e.g. 18W LED downlight" />
    </td>
    <td>
      <textarea class="item-desc" placeholder="Full description...">${item?.description || ""}</textarea>
    </td>
    <td>
      <input type="text" class="item-unit" value="${item?.unit || "pcs"}" />
    </td>
    <td>
      <input type="number" class="item-qty" value="${item?.quantity || 1}" step="0.01" min="0" />
    </td>
    <td>
      <input type="number" class="item-cost" value="${item?.unit_cost || 0}" step="0.01" min="0" />
    </td>
    <td>
      <input type="number" class="item-price" value="${item?.unit_price || 0}" step="0.01" min="0" />
    </td>
    <td>
      <input type="number" class="item-amount" value="${item?.amount || 0}" readonly />
    </td>
    <td>
      <button type="button" class="btn-save-favorite" title="Save this line to Favourites" aria-label="Save this line to Favourites">☆</button>
      <button type="button" class="btn-remove-item">×</button>
    </td>
  `;

  tbody.appendChild(tr);

  const trackedFields = [...tr.querySelectorAll("input, textarea")].filter(field => !field.classList.contains("item-amount"));
  tr.dataset.originalValues = JSON.stringify(trackedFields.map(field => field.value));
  trackedFields.forEach(field => field.addEventListener("input", updateQuotationLineIndicators));
  updateQuotationLineIndicators();

  const qtyInput = tr.querySelector(".item-qty");
  const priceInput = tr.querySelector(".item-price");
  const amountInput = tr.querySelector(".item-amount");

  function calculate() {
    const qty = parseFloat(qtyInput.value) || 0;
    const price = parseFloat(priceInput.value) || 0;
    amountInput.value = (qty * price).toFixed(2);
    updateQuotationTotal();
  }

  qtyInput.addEventListener("input", calculate);
  priceInput.addEventListener("input", calculate);
  calculate();

  tr.querySelector(".btn-remove-item").addEventListener("click", () => {
    tr.remove();
    updateQuotationTotal();
    updateQuotationLineIndicators();
  });
  tr.querySelector(".btn-save-favorite").addEventListener("click", () => saveFavoriteFromRow("quotation", tr));
}

function updateQuotationTotal() {
  let total = 0;
  document.querySelectorAll(".item-amount").forEach(input => {
    total += parseFloat(input.value) || 0;
  });
  document.getElementById("quotation-total").textContent = "RM " + total.toFixed(2);
}

function updateQuotationLineIndicators() {
  const rows = [...document.querySelectorAll("#items-body tr")];
  const keys = rows.map(row => {
    const value = selector => (row.querySelector(selector)?.value || "").trim().toLowerCase().replace(/\s+/g, " ");
    return [value(".item-section"), value(".item-name"), value(".item-desc")].join("|#|");
  });
  const counts = new Map();
  keys.forEach((key, index) => {
    if (key !== "|#| |#|" && (rows[index].querySelector(".item-name").value.trim() || rows[index].querySelector(".item-desc").value.trim())) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  });

  rows.forEach((row, index) => {
    const number = row.querySelector(".line-number");
    const indicators = row.querySelector(".line-indicators");
    if (!number || !indicators) return;
    number.textContent = String(index + 1);

    const trackedFields = [...row.querySelectorAll("input, textarea")].filter(field => !field.classList.contains("item-amount"));
    const original = JSON.parse(row.dataset.originalValues || "[]");
    const changed = row.dataset.isNew !== "true" && trackedFields.some((field, fieldIndex) => field.value !== original[fieldIndex]);
    const duplicate = counts.get(keys[index]) > 1;
    const badges = [];
    if (row.dataset.isNew === "true") badges.push('<span class="line-badge line-new" title="New line">NEW</span>');
    else if (changed) badges.push('<span class="line-badge line-changed" title="Edited since this quotation was opened">EDITED</span>');
    if (duplicate) badges.push('<span class="line-badge line-duplicate" title="Another line has the same section, item name, and description">⚠ DUPLICATE</span>');
    indicators.innerHTML = badges.join("");
    row.classList.toggle("quotation-line-duplicate", duplicate);
    row.classList.toggle("quotation-line-changed", changed);
  });
}

function replaceAllQuotationText() {
  const findText = document.getElementById("quotation-find-text")?.value || "";
  const replaceText = document.getElementById("quotation-replace-text")?.value ?? "";
  const message = document.getElementById("quotation-edit-message");
  if (!findText) {
    if (message) message.textContent = "Enter text to find first.";
    return;
  }

  const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(escaped, "gi");
  let fieldsChanged = 0;
  const linesChanged = new Set();
  document.querySelectorAll("#items-body tr").forEach(row => {
    [".item-section", ".item-name", ".item-desc", ".item-unit"].forEach(selector => {
      const field = row.querySelector(selector);
      if (!field || !matcher.test(field.value)) {
        matcher.lastIndex = 0;
        return;
      }
      matcher.lastIndex = 0;
      field.value = field.value.replace(matcher, replaceText);
      matcher.lastIndex = 0;
      fieldsChanged += 1;
      linesChanged.add(row);
    });
  });

  updateQuotationLineIndicators();
  if (message) {
    message.textContent = fieldsChanged
      ? `Replaced text in ${fieldsChanged} field(s) across ${linesChanged.size} line(s). Review the marked lines, then save.`
      : "No matching text found in the quotation lines.";
  }
}

async function saveQuotation() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return alert("Please login");

  const items = [];
  document.querySelectorAll("#items-body tr").forEach((tr, index) => {
    const itemName = tr.querySelector(".item-name").value.trim();
    const desc = tr.querySelector(".item-desc").value.trim();

    if (!itemName && !desc) return;

    const qty = parseFloat(tr.querySelector(".item-qty").value) || 0;
    const cost = parseFloat(tr.querySelector(".item-cost").value) || 0;
    const price = parseFloat(tr.querySelector(".item-price").value) || 0;
    const amount = qty * price;

    items.push({
      item_name: itemName,
      description: desc,
      unit: tr.querySelector(".item-unit").value.trim() || "pcs",
      quantity: qty,
      unit_cost: cost,
      unit_price: price,
      amount: amount,
      section: tr.querySelector(".item-section").value.trim() || "General",
      sort_order: index
    });
  });

  if (items.length === 0) {
    return alert("Please add at least one item");
  }

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const preparedBy = document.getElementById("quotation-prepared-by").value.trim();
  const notes = document.getElementById("quotation-notes").value.trim();

  if (currentQuotationId) {
    // ========== UPDATE existing quotation ==========
    const { error } = await supabaseClient
      .from("quotations")
      .update({
        total_amount: totalAmount,
        notes: notes,
        prepared_by: preparedBy,
        updated_at: new Date().toISOString()
      })
      .eq("id", currentQuotationId);

    if (error) {
      console.error(error);
      return alert("Failed to update quotation: " + error.message);
    }

    // Delete old items and insert new ones
    await supabaseClient.from("quotation_items").delete().eq("quotation_id", currentQuotationId);

    const itemsWithId = items.map(item => ({
      ...item,
      quotation_id: currentQuotationId
    }));

    const { error: itemsError } = await supabaseClient
      .from("quotation_items")
      .insert(itemsWithId);

    if (itemsError) {
      console.error(itemsError);
      return alert("Failed to update items: " + itemsError.message);
    }

    alert("Quotation updated successfully!");
  } else {
    // ========== CREATE new quotation ==========
    const quotationNo = await generateQuotationNumber();

const { data: quotation, error } = await supabaseClient
  .from("quotations")
  .insert([{
    project_id: currentProjectId,
    user_id: user.id,
    version_no: 1,
    status: "draft",
    total_amount: totalAmount,
    notes: notes,
    prepared_by: preparedBy,
    quotation_no: quotationNo
  }])
  .select()
  .single();

    if (error) {
      console.error(error);
      return alert("Failed to save quotation: " + error.message);
    }

    const itemsWithId = items.map(item => ({
      ...item,
      quotation_id: quotation.id
    }));

    const { error: itemsError } = await supabaseClient
      .from("quotation_items")
      .insert(itemsWithId);

    if (itemsError) {
      console.error(itemsError);
      return alert("Failed to save items: " + itemsError.message);
    }

    alert("Quotation saved successfully!");
  }

  closeQuotationForm();
  loadQuotations(currentProjectId);
  loadVos(currentProjectId);
}
async function loadQuotations(projectId) {
  const { data, error } = await supabaseClient
    .from("quotations")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const list = document.getElementById("quotations-list");

  if (error) {
    list.innerHTML = `<div class="empty-state">Error loading quotations</div>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>No quotations yet.</p>
        <p>Click "+ New Quotation" to create one.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = data.map(q => `
  <div class="project-card">
    <div class="project-info">
      <h3>Quotation ${q.quotation_no || ""} v${q.version_no}</h3>
      <p>Total: <strong>RM ${Number(q.total_amount).toFixed(2)}</strong></p>
      <p>Created: ${new Date(q.created_at).toLocaleDateString()}</p>
      <span class="project-status status-${q.status}">${q.status}</span>
    </div>
    <div class="project-actions">
      <button class="btn-edit" onclick="viewQuotation('${q.id}')">View</button>
      <button class="btn-edit" onclick="editQuotation('${q.id}')" style="background:#0ea5e9;">Edit</button>
      <button class="btn-delete" onclick="deleteQuotation('${q.id}')">Delete</button>
    </div>
  </div>
`).join("");
}

async function viewQuotation(id) {
  alert("View Quotation will be built in the next step (with version comparison + PDF)");
}


// ====================== VIEW & EDIT QUOTATION ======================

async function viewQuotation(quotationId) {
  // Load quotation
  const { data: quotation, error } = await supabaseClient
    .from("quotations")
    .select("*")
    .eq("id", quotationId)
    .single();

  if (error) return alert("Failed to load quotation");

  // Load items
  const { data: items, error: itemsError } = await supabaseClient
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("sort_order");

  if (itemsError) return alert("Failed to load items");

  // Load project (for Bill To)
  const { data: project } = await supabaseClient
    .from("projects")
    .select("*")
    .eq("id", quotation.project_id)
    .single();

  // Load company (more reliable)
const { data: { user } } = await supabaseClient.auth.getUser();
let company = null;

if (user) {
  const { data, error } = await supabaseClient
    .from("companies")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();          // better than .single()

  if (error) {
    console.error("Company load error:", error);
  } else {
    company = data;
    console.log("Company data loaded:", company);   // for checking
  }
}

  // Group by section
  const grouped = {};
  items.forEach(item => {
    const section = item.section || "General";
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(item);
  });

  // ========== BUILD HTML ==========
  let html = `
    <div id="quotation-pdf-content" style="background:white; padding:36px; font-family:'Segoe UI',sans-serif; color:#1e293b; max-width:900px;">

      <!-- HEADER -->
      <div style="display:flex; justify-content:space-between; margin-bottom:28px; border-bottom:2px solid #e2e8f0; padding-bottom:20px;">
        <div>
          ${company?.logo_url ? `<img src="${company.logo_url}" style="max-height:65px; margin-bottom:8px;" />` : ""}
          <h2 style="margin:0 0 4px; font-size:1.35rem;">${company?.company_name || "Company Name"}</h2>
          <p style="margin:0; font-size:0.82rem; color:#64748b; white-space:pre-line;">${company?.address || ""}</p>
          <p style="margin:3px 0 0; font-size:0.82rem; color:#64748b;">
            ${company?.phone ? "Tel: " + company.phone : ""} ${company?.email ? " | " + company.email : ""}
          </p>
          ${company?.ssm_no ? `<p style="margin:2px 0 0; font-size:0.82rem; color:#64748b;">SSM: ${company.ssm_no}</p>` : ""}
        </div>
        <div style="text-align:right;">
          <h1 style="margin:0 0 6px; color:#2563eb; font-size:1.7rem; letter-spacing:1px;">QUOTATION</h1>
          <p style="margin:0; font-size:0.9rem;"><strong>No:</strong> ${quotation.quotation_no || "-"}</p>
          <p style="margin:3px 0; font-size:0.9rem;"><strong>Version:</strong> v${quotation.version_no}</p>
          <p style="margin:3px 0; font-size:0.9rem;"><strong>Date:</strong> ${new Date(quotation.created_at).toLocaleDateString()}</p>
          <p style="margin:3px 0; font-size:0.9rem;"><strong>Status:</strong> ${quotation.status.toUpperCase()}</p>
        </div>
      </div>

      <!-- BILL TO -->
      <div style="margin-bottom:24px; background:#f8fafc; padding:14px 18px; border-radius:8px;">
        <p style="margin:0 0 4px; font-size:0.8rem; color:#64748b; font-weight:600;">BILL TO</p>
        <p style="margin:0; font-weight:600; font-size:1.05rem;">${project?.client_name || "-"}</p>
        <p style="margin:3px 0 0; font-size:0.88rem; white-space:pre-line;">${project?.client_address || ""}</p>
        <p style="margin:3px 0 0; font-size:0.88rem;">
          ${project?.client_phone || ""} ${project?.client_email ? " | " + project.client_email : ""}
        </p>
      </div>

      <!-- ITEMS -->
  `;

  for (const [section, sectionItems] of Object.entries(grouped)) {
    html += `
      <div style="margin-bottom:22px;">
        <h3 style="background:#f1f5f9; padding:9px 14px; border-radius:6px; margin:0 0 10px; font-size:1rem;">${section}</h3>
        <table class="pdf-items-table" style="width:100%; border-collapse:collapse; font-size:0.86rem;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="text-align:left; padding:8px; width:17%; border-bottom:1px solid #e2e8f0;">Item Name</th>
              <th style="text-align:left; padding:8px; width:41%; border-bottom:1px solid #e2e8f0;">Description</th>
              <th style="text-align:center; padding:8px; border-bottom:1px solid #e2e8f0;">Unit</th>
              <th style="text-align:center; padding:8px; border-bottom:1px solid #e2e8f0;">Qty</th>
              <th style="text-align:right; padding:8px; border-bottom:1px solid #e2e8f0;">Unit Price</th>
              <th style="text-align:right; padding:8px; border-bottom:1px solid #e2e8f0;">Amount (RM)</th>
            </tr>
          </thead>
          <tbody>
    `;

    sectionItems.forEach(item => {
      html += `
        <tr>
          <td style="padding:9px 8px; vertical-align:top; font-weight:500; border-bottom:1px solid #f1f5f9;">${item.item_name || "-"}</td>
          <td style="padding:9px 8px; vertical-align:top; white-space:pre-line; border-bottom:1px solid #f1f5f9;">${item.description || "-"}</td>
          <td style="padding:9px 6px; text-align:center; border-bottom:1px solid #f1f5f9;">${item.unit}</td>
          <td style="padding:9px 6px; text-align:center; border-bottom:1px solid #f1f5f9;">${item.quantity}</td>
          <td style="padding:9px 8px; text-align:right; border-bottom:1px solid #f1f5f9;">${Number(item.unit_price).toFixed(2)}</td>
          <td style="padding:9px 8px; text-align:right; font-weight:500; border-bottom:1px solid #f1f5f9;">${Number(item.amount).toFixed(2)}</td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
  }

  // TOTAL + PAYMENT + T&C
  html += `
      <!-- TOTAL -->
      <div style="margin-top:16px; text-align:right; padding:14px 18px; background:#f8fafc; border-radius:8px;">
        <span style="font-size:1.1rem;">Grand Total:</span>
        <strong style="font-size:1.35rem; color:#2563eb; margin-left:12px;">RM ${Number(quotation.total_amount).toFixed(2)}</strong>
      </div>

      <!-- PAYMENT DETAILS -->
      <div style="margin-top:28px; padding:16px 18px; background:#f0f9ff; border-radius:8px; border-left:4px solid #3b82f6;">
        <p style="margin:0 0 8px; font-weight:600; color:#1e40af;">PAYMENT DETAILS</p>
        <p style="margin:0; font-size:0.9rem;"><strong>Bank:</strong> ${company?.account_holder || "-"} ${company?.account_handler ? "(" + company.account_handler + ")" : ""}</p>
        <p style="margin:4px 0 0; font-size:0.9rem;"><strong>Account No:</strong> ${company?.account_number || "-"}</p>
        <p style="margin:8px 0 0; font-size:0.85rem; color:#64748b;">Please send proof of payment via WhatsApp or Email after transfer.</p>
      </div>

      <!-- T&C -->
<div style="margin-top:32px; font-size:0.8rem; color:#475569; line-height:1.55;">
  <p style="font-weight:600; margin-bottom:8px; color:#1e293b;">TERMS AND CONDITIONS</p>
  <ol style="padding-left:18px; margin:0;">
    <li>This quotation is valid for 14 days from the date of issue and is applicable for this project only. Prices for optional items are valid only when purchased as a complete set. Prices will differ if ordered separately.</li>
    
    <li>Only items and quantities listed in this quotation are included. Any additional work, material, or charges not stated must be agreed by both parties in writing (Variation Order) before implementation. Any work carried out without mutual written agreement may cause the project to be terminated at the Contractor’s discretion. In such event, the Client must pay for all work done and materials supplied up to the termination date. Fine charges may apply.</li>
    
    <li>Payment Terms:<br>
      • 20% deposit payable when the renovation team moves in and starts work<br>
      • 30% upon completion of the first major stage<br>
      • 25% mid-stage progress payment<br>
      • 20% upon practical completion<br>
      • 5% defect liability sum (to be released within 7 days after joint inspection, signed defect list, and all defects rectified)
    </li>
    
    <li>Work will only commence after the 20% deposit is received. If any payment is not received within 7 days from the invoice date, the Contractor reserves the right to suspend all works immediately. The suspension period shall not be counted into the project timeline. Late payment shall attract interest of 1.5% per month.</li>
    
    <li>This quotation is subject to actual site measurements. If the actual quantities differ from the quotation, the Contractor reserves the right to amend the amount accordingly.</li>
    
    <li>All materials remain the property of the Contractor until full payment is received. The Contractor reserves the right to remove materials from site in the event of non-payment.</li>
    
    <li>Any delay caused by the Client (late decision, late material selection, late site access, late payment, etc.) shall entitle the Contractor to an extension of time.</li>
    
    <li>Estimated project duration is subject to confirmation of order and site readiness. Any request for rush / overtime work will be discussed and charged separately.</li>
    
    <li>In the event of termination due to non-payment or breach of these terms, the Client shall pay for all work completed and materials supplied up to the termination date.</li>
    
    <li>This quotation and agreement shall be governed by the laws of Malaysia.</li>
  </ol>

  <p style="margin-top:16px; font-weight:500; color:#1e293b;">
    This is a computer-generated quotation. No signature is required.<br>
    Payment of the deposit shall constitute full acceptance of this quotation and all Terms & Conditions stated herein.
  </p>
</div>

      <!-- FOOTER -->
      <div style="margin-top:36px; display:flex; justify-content:space-between; align-items:flex-end;">
        <div style="font-size:0.85rem; color:#64748b;">
          <p style="margin:0;">Prepared by: <strong>${quotation.prepared_by || "-"}</strong></p>
          ${quotation.notes ? `<p style="margin:4px 0 0;">Notes: ${quotation.notes}</p>` : ""}
        </div>
        <div>
          ${company?.chop_url ? `<img src="${company.chop_url}" style="max-height:75px;" />` : ""}
        </div>
      </div>
    </div>

    <!-- ACTION BUTTONS -->
    <div style="display:flex; gap:12px; margin-top:24px; flex-wrap:wrap;">
      <button onclick="generatePDF()" class="btn-primary" style="width:auto;">Preview / Save as PDF</button>
      <button onclick="changeQuotationStatus('${quotation.id}', 'adjusting')" class="btn-secondary" style="width:auto; background:#f59e0b; color:white;">Mark as Adjusting</button>
      <button onclick="changeQuotationStatus('${quotation.id}', 'approved')" class="btn-secondary" style="width:auto; background:#10b981; color:white;">Mark as Approved</button>
      <button onclick="closeViewQuotation()" class="btn-secondary" style="width:auto;">Close</button>
    </div>
  `;

  const container = document.getElementById("quotation-form-container");
  container.classList.remove("hidden");
  container.innerHTML = html;
  container.scrollIntoView({ behavior: "smooth" });
}

function closeViewQuotation() {
  const container = document.getElementById("quotation-form-container");
  container.classList.add("hidden");
  container.innerHTML = "";   // clear the view content

  // Re-load lists
  if (currentProjectId) {
    loadQuotations(currentProjectId);
    loadVos(currentProjectId);
  }
  
  // Restore the original Create/Edit form structure
  container.innerHTML = `
    <h3 id="quotation-form-title">New Quotation</h3>
    
    <div class="form-row">
      <div class="form-group">
        <label>Prepared By</label>
        <input type="text" id="quotation-prepared-by" />
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" id="quotation-notes" placeholder="Optional notes" />
      </div>
    </div>

    <h4 style="margin: 24px 0 12px;">Line Items</h4>

    <div class="quotation-edit-tools">
      <label>Find <input type="text" id="quotation-find-text" placeholder="Word or phrase" /></label>
      <label>Replace with <input type="text" id="quotation-replace-text" placeholder="Replacement text" /></label>
      <button type="button" id="btn-replace-all-quotation-text" class="btn-secondary" style="width:auto;">Replace in all lines</button>
      <span id="quotation-edit-message" role="status" aria-live="polite"></span>
      <span class="line-help">Line markers show new, edited, or duplicate entries.</span>
    </div>
    
    <div class="table-responsive">
      <table class="items-table" id="items-table">
        <thead>
          <tr>
            <th style="width:8%">Line</th>
            <th style="width:11%">Section</th>
            <th style="width:16%">Item Name</th>
            <th style="width:33%">Description</th>
            <th style="width:6%">Unit</th>
            <th style="width:6%">Qty</th>
            <th style="width:9%">Unit Cost</th>
            <th style="width:9%">Unit Price</th>
            <th style="width:8%">Amount</th>
            <th style="width:2%"></th>
          </tr>
        </thead>
        <tbody id="items-body">
          <!-- rows will be added here -->
        </tbody>
      </table>
    </div>

    <button type="button" id="btn-add-item" class="btn-secondary" style="width:auto; margin-top:12px;">+ Add Item</button>
      <div class="favourite-insert-tools">
        <label for="quotation-favourite-picker">Reusable line</label>
        <select id="quotation-favourite-picker"><option value="">Choose a favourite line</option></select>
        <button type="button" id="btn-insert-quotation-favourite" class="btn-secondary" style="width:auto;">Add to quotation</button>
      </div>

    <div class="totals-box">
      <div class="total-row">
        <span>Total Amount:</span>
        <strong id="quotation-total">RM 0.00</strong>
      </div>
    </div>

    <div style="display:flex; gap:12px; margin-top:24px;">
      <button type="button" id="btn-save-quotation" class="btn-primary" style="width:auto;">Save Quotation</button>
      <button type="button" id="btn-cancel-quotation" class="btn-secondary" style="width:auto;">Cancel</button>
    </div>
  `;

  // Re-attach event listeners
  document.getElementById("btn-add-item").addEventListener("click", () => addItemRow());
  document.getElementById("btn-save-quotation").addEventListener("click", () => saveQuotation());
  document.getElementById("btn-cancel-quotation").addEventListener("click", () => closeQuotationForm());
  document.getElementById("btn-replace-all-quotation-text").addEventListener("click", replaceAllQuotationText);
  document.getElementById("btn-insert-quotation-favourite").addEventListener("click", () => insertSelectedFavorite("quotation"));
  refreshFavoritePickers();
}


function generatePDF() {
  const quotation = document.getElementById("quotation-pdf-content");
  if (!quotation) return alert("Nothing to preview");

  // Open immediately from the click so the browser does not block the tab.
  const previewWindow = window.open("", "_blank");
  if (!previewWindow) {
    return alert("The preview tab was blocked. Allow pop-ups for this app, then try again.");
  }

  const previewDocument = previewWindow.document;
  previewDocument.open();
  previewDocument.write(`<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Quotation Preview</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; color: #1e293b; font-family: Arial, sans-serif; }
        body { background: #e2e8f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .preview-toolbar { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 20px; background: #0f172a; color: white; }
        .preview-toolbar button { border: 0; border-radius: 7px; padding: 10px 16px; cursor: pointer; font-size: 14px; font-weight: 600; }
        .preview-toolbar .print-button { background: #2563eb; color: white; }
        .preview-toolbar .close-button { background: #e2e8f0; color: #1e293b; }
        #preview-content { width: 190mm; min-height: 277mm; margin: 24px auto; padding: 0; background: white; box-shadow: 0 4px 24px rgba(15,23,42,.18); }
        #quotation-pdf-content { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
        .pdf-items-table { width: 100% !important; table-layout: fixed; border-collapse: collapse; }
        .pdf-items-table th, .pdf-items-table td { overflow-wrap: anywhere; word-break: break-word; }
        .pdf-items-table thead { display: table-header-group; }
        .pdf-items-table tr, .pdf-items-table img { break-inside: avoid; page-break-inside: avoid; }
        h3 { break-after: avoid; page-break-after: avoid; }
        @media screen and (max-width: 760px) { #preview-content { width: calc(100% - 24px); min-height: 0; padding: 16px; } }
        @media print {
          html, body { width: auto; background: white; }
          .preview-toolbar { display: none !important; }
          #preview-content { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
          #quotation-pdf-content { padding: 0 !important; }
        }
      </style>
    </head>
    <body>
      <header class="preview-toolbar">
        <strong>Quotation preview · A4</strong>
        <div>
          <button type="button" class="print-button" id="preview-print">Print / Save as PDF</button>
          <button type="button" class="close-button" id="preview-close">Close preview</button>
        </div>
      </header>
      <main id="preview-content"></main>
    </body>
    </html>`);
  previewDocument.close();
  previewWindow.document.title = "Quotation Preview";

  const copy = previewDocument.importNode(quotation, true);
  copy.querySelectorAll("script").forEach(script => script.remove());
  copy.querySelectorAll("*").forEach(node => {
    [...node.attributes].forEach(attribute => {
      if (attribute.name.toLowerCase().startsWith("on")) node.removeAttribute(attribute.name);
    });
  });
  previewDocument.getElementById("preview-content").appendChild(copy);

  previewDocument.getElementById("preview-print").addEventListener("click", async () => {
    const images = [...previewDocument.images];
    await Promise.all(images.map(image => image.decode ? image.decode().catch(() => {}) : Promise.resolve()));
    previewWindow.focus();
    previewWindow.print();
  });
  previewDocument.getElementById("preview-close").addEventListener("click", () => previewWindow.close());
}

async function changeQuotationStatus(quotationId, newStatus) {
  if (!confirm(`Change status to "${newStatus.toUpperCase()}"?`)) return;

  const { error } = await supabaseClient
    .from("quotations")
    .update({ 
      status: newStatus,
      updated_at: new Date().toISOString(),
      approved_at: newStatus === "approved" ? new Date().toISOString() : null
    })
    .eq("id", quotationId);

  if (error) {
    alert("Failed to update status: " + error.message);
    return;
  }

  alert(`Status changed to ${newStatus.toUpperCase()}`);
  closeViewQuotation();
  loadQuotations(currentProjectId);
}


async function createNewVersion(oldQuotationId) {
  if (!confirm("Create a new version based on this quotation?")) return;

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return alert("Please login");

  // 1. Load old quotation
  const { data: oldQuotation, error } = await supabaseClient
    .from("quotations")
    .select("*")
    .eq("id", oldQuotationId)
    .single();

  if (error) return alert("Failed to load quotation");

  // 2. Load old items
  const { data: oldItems, error: itemsError } = await supabaseClient
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", oldQuotationId)
    .order("sort_order");

  if (itemsError) return alert("Failed to load items");

  // 3. Generate new quotation number
  const newQuotationNo = await generateQuotationNumber();

  // 4. Create new quotation
  const { data: newQuotation, error: createError } = await supabaseClient
    .from("quotations")
    .insert([{
      project_id: oldQuotation.project_id,
      user_id: user.id,
      version_no: oldQuotation.version_no + 1,
      status: "draft",
      total_amount: oldQuotation.total_amount,
      notes: oldQuotation.notes,
      prepared_by: oldQuotation.prepared_by,
      quotation_no: newQuotationNo
    }])
    .select()
    .single();

  if (createError) {
    console.error(createError);
    return alert("Failed to create new version: " + createError.message);
  }

  // 5. Copy all items to new quotation
  if (oldItems && oldItems.length > 0) {
    const newItems = oldItems.map(item => ({
      quotation_id: newQuotation.id,
      item_name: item.item_name,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      unit_price: item.unit_price,
      amount: item.amount,
      section: item.section,
      sort_order: item.sort_order
    }));

    const { error: insertItemsError } = await supabaseClient
      .from("quotation_items")
      .insert(newItems);

    if (insertItemsError) {
      console.error(insertItemsError);
      return alert("Failed to copy items: " + insertItemsError.message);
    }
  }

  alert(`New version created successfully!\nQuotation No: ${newQuotationNo}\nVersion: v${newQuotation.version_no}`);
  
  closeViewQuotation();
  loadQuotations(currentProjectId);
}


// ====================== VARIATION ORDERS ======================

let currentVoId = null;

document.getElementById("btn-new-vo")?.addEventListener("click", () => {
  openVoForm();
});

document.getElementById("btn-cancel-vo")?.addEventListener("click", () => {
  closeVoForm();
});

document.getElementById("btn-add-vo-item")?.addEventListener("click", () => {
  addVoItemRow();
});

document.getElementById("btn-insert-vo-favourite")?.addEventListener("click", () => insertSelectedFavorite("vo"));

document.getElementById("btn-save-vo")?.addEventListener("click", async () => {
  await saveVo();
  // After loadQuotations and loadVos
await updateContractSummary(currentProjectId);
});

function openVoForm(vo = null) {
  currentVoId = vo ? vo.id : null;
  const container = document.getElementById("vo-form-container");
container.classList.remove("hidden");

  document.getElementById("vo-form-title").textContent = vo ? "Edit Variation Order" : "New Variation Order";
  document.getElementById("vo-title").value = vo?.title || "";
  document.getElementById("vo-notes").value = vo?.notes || "";

  document.getElementById("vo-items-body").innerHTML = "";
  addVoItemRow();
  updateVoTotal();

  container.scrollIntoView({ behavior: "smooth" });
}

function closeVoForm() {
  document.getElementById("vo-form-container").classList.add("hidden");
  currentVoId = null;
}

function addVoItemRow(item = null) {
  const tbody = document.getElementById("vo-items-body");
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td>
      <select class="vo-change-type">
        <option value="add" ${item?.change_type === "add" ? "selected" : ""}>Add</option>
        <option value="change" ${item?.change_type === "change" ? "selected" : ""}>Change</option>
        <option value="omit" ${item?.change_type === "omit" ? "selected" : ""}>Omit</option>
      </select>
    </td>
    <td>
      <input type="text" class="vo-section" value="${item?.section || ""}" placeholder="e.g. Kitchen" />
    </td>
    <td>
      <input type="text" class="vo-item-name" value="${item?.item_name || ""}" placeholder="Item name" />
    </td>
    <td>
      <textarea class="vo-desc" placeholder="Description...">${item?.description || ""}</textarea>
    </td>
    <td>
      <input type="text" class="vo-unit" value="${item?.unit || "pcs"}" />
    </td>
    <td>
      <input type="number" class="vo-qty" value="${item?.quantity || 1}" step="0.01" min="0" />
    </td>
    <td>
      <input type="number" class="vo-price" value="${item?.unit_price || 0}" step="0.01" min="0" />
    </td>
    <td>
      <input type="number" class="vo-amount" value="${item?.amount || 0}" readonly />
    </td>
    <td>
      <button type="button" class="btn-save-favorite" title="Save this line to Favourites" aria-label="Save this line to Favourites">☆</button>
      <button type="button" class="btn-remove-item">×</button>
    </td>
  `;

  tbody.appendChild(tr);

  const qtyInput = tr.querySelector(".vo-qty");
  const priceInput = tr.querySelector(".vo-price");
  const amountInput = tr.querySelector(".vo-amount");
  const typeSelect = tr.querySelector(".vo-change-type");

  function calculate() {
    let qty = parseFloat(qtyInput.value) || 0;
    let price = parseFloat(priceInput.value) || 0;

    // If Omit, make amount negative
    if (typeSelect.value === "omit") {
      amountInput.value = (-Math.abs(qty * price)).toFixed(2);
    } else {
      amountInput.value = (qty * price).toFixed(2);
    }
    updateVoTotal();
  }

  qtyInput.addEventListener("input", calculate);
  priceInput.addEventListener("input", calculate);
  typeSelect.addEventListener("change", calculate);
  calculate();

  tr.querySelector(".btn-remove-item").addEventListener("click", () => {
    tr.remove();
    updateVoTotal();
  });
  tr.querySelector(".btn-save-favorite").addEventListener("click", () => saveFavoriteFromRow("vo", tr));
}

function updateVoTotal() {
  let total = 0;
  document.querySelectorAll(".vo-amount").forEach(input => {
    total += parseFloat(input.value) || 0;
  });
  document.getElementById("vo-total").textContent = "RM " + total.toFixed(2);
}

async function generateVoNumber() {
  const { data } = await supabaseClient
    .from("variation_orders")
    .select("vo_number")
    .like("vo_number", "VO%")
    .order("vo_number", { ascending: false })
    .limit(1);

  let nextNumber = 100001;
  if (data && data.length > 0 && data[0].vo_number) {
    const lastNum = parseInt(data[0].vo_number.replace("VO", ""));
    if (!isNaN(lastNum)) nextNumber = lastNum + 1;
  }
  return `VO${nextNumber}`;
}

async function saveVo() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return alert("Please login");

  const items = [];
  document.querySelectorAll("#vo-items-body tr").forEach((tr, index) => {
    const itemName = tr.querySelector(".vo-item-name").value.trim();
    const desc = tr.querySelector(".vo-desc").value.trim();
    if (!itemName && !desc) return;

    const quantity = parseFloat(tr.querySelector(".vo-qty").value) || 0;
    const unitPrice = parseFloat(tr.querySelector(".vo-price").value) || 0;
    const changeType = tr.querySelector(".vo-change-type").value;
    let amount = quantity * unitPrice;

    if (changeType === "omit") amount = -Math.abs(amount);

    items.push({
      item_name: itemName,
      description: desc,
      unit: tr.querySelector(".vo-unit").value.trim() || "pcs",
      quantity,
      unit_price: unitPrice,
      amount,
      section: tr.querySelector(".vo-section").value.trim() || "General",
      change_type: changeType,
      sort_order: index
    });
  });

  if (items.length === 0) {
    return alert("Please add at least one item");
  }

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const title =
    document.getElementById("vo-title").value.trim() || "Variation Order";
  const notes = document.getElementById("vo-notes").value.trim();

  let voId = currentVoId;

  if (voId) {
    const { error } = await supabaseClient
      .from("variation_orders")
      .update({
        title,
        notes,
        total_amount: totalAmount,
        updated_at: new Date().toISOString()
      })
      .eq("id", voId);

    if (error) {
      return alert("Failed to update VO: " + error.message);
    }

    const { error: deleteError } = await supabaseClient
      .from("vo_items")
      .delete()
      .eq("vo_id", voId);

    if (deleteError) {
      return alert("Failed to replace VO items: " + deleteError.message);
    }
  } else {
    const voNumber = await generateVoNumber();

    const { data: vo, error } = await supabaseClient
      .from("variation_orders")
      .insert([{
        project_id: currentProjectId,
        user_id: user.id,
        vo_number: voNumber,
        title,
        status: "draft",
        total_amount: totalAmount,
        notes
      }])
      .select()
      .single();

    if (error) {
      return alert("Failed to save VO: " + error.message);
    }

    voId = vo.id;
  }

  const itemsWithId = items.map(item => ({
    ...item,
    vo_id: voId
  }));

  const { error: itemsError } = await supabaseClient
    .from("vo_items")
    .insert(itemsWithId);

  if (itemsError) {
    return alert("Failed to save VO items: " + itemsError.message);
  }

  alert(currentVoId ? "VO updated successfully!" : "VO saved successfully!");
  closeVoForm();
  await loadVos(currentProjectId);
  await updateContractSummary(currentProjectId);
}

async function loadVos(projectId) {
  const { data, error } = await supabaseClient
    .from("variation_orders")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const list = document.getElementById("vo-list");

  if (error) {
    list.innerHTML = `<div class="empty-state">Error loading VOs</div>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>No Variation Orders yet.</p>
        <p>Click "+ New VO" to create one.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = data.map(vo => `
    <div class="project-card">
      <div class="project-info">
        <h3>${vo.vo_number} - ${vo.title || "Variation Order"}</h3>
        <p>Total: <strong>RM ${Number(vo.total_amount).toFixed(2)}</strong></p>
        <p>Created: ${new Date(vo.created_at).toLocaleDateString()}</p>
        <span class="project-status status-${vo.status}">${vo.status}</span>
      </div>
      <div class="project-actions">
        <button class="btn-edit" onclick="viewVo('${vo.id}')">View</button>
        <button class="btn-edit" onclick="editVo('${vo.id}')" style="background:#0ea5e9;">Edit</button>
        <button class="btn-delete" onclick="deleteVo('${vo.id}')">Delete</button>
      </div>
    </div>
  `).join("");
}

// Call loadVos when opening project detail
// (We will hook this into openProjectDetail)



async function viewVo(voId) {
  const { data: vo, error } = await supabaseClient
    .from("variation_orders")
    .select("*")
    .eq("id", voId)
    .single();

  if (error) return alert("Failed to load VO");

  const { data: items, error: itemsError } = await supabaseClient
    .from("vo_items")
    .select("*")
    .eq("vo_id", voId)
    .order("sort_order");

  if (itemsError) return alert("Failed to load VO items");

  // Group by section
  const grouped = {};
  items.forEach(item => {
    const section = item.section || "General";
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(item);
  });

  let html = `
    <div style="background:white; padding:28px; border-radius:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <div>
          <h2 style="margin-bottom:4px;">${vo.vo_number}</h2>
          <p style="color:#64748b; margin:0;">${vo.title || "Variation Order"}</p>
          <p style="color:#64748b; margin:4px 0 0;">
            Status: <strong>${vo.status}</strong> | 
            Total: <strong style="color:#2563eb;">RM ${Number(vo.total_amount).toFixed(2)}</strong>
          </p>
        </div>
        <button onclick="closeVoView()" class="btn-secondary" style="width:auto;">Close</button>
      </div>
  `;

  for (const [section, sectionItems] of Object.entries(grouped)) {
    html += `
      <div style="margin-bottom:24px;">
        <h3 style="background:#f1f5f9; padding:10px 14px; border-radius:8px; margin-bottom:12px;">${section}</h3>
        <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="text-align:left; padding:8px; width:10%;">Type</th>
              <th style="text-align:left; padding:8px; width:18%;">Item Name</th>
              <th style="text-align:left; padding:8px; width:36%;">Description</th>
              <th style="text-align:center; padding:8px;">Unit</th>
              <th style="text-align:center; padding:8px;">Qty</th>
              <th style="text-align:right; padding:8px;">Unit Price</th>
              <th style="text-align:right; padding:8px;">Amount</th>
            </tr>
          </thead>
          <tbody>
    `;

    sectionItems.forEach(item => {
      const typeColor = item.change_type === "add" ? "#10b981" : 
                        item.change_type === "omit" ? "#ef4444" : "#f59e0b";
      html += `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 8px; color:${typeColor}; font-weight:600; text-transform:uppercase; font-size:0.8rem;">
            ${item.change_type}
          </td>
          <td style="padding:10px 8px; vertical-align:top; font-weight:500;">${item.item_name || "-"}</td>
          <td style="padding:10px 8px; vertical-align:top; white-space:pre-line;">${item.description || "-"}</td>
          <td style="padding:10px 8px; text-align:center;">${item.unit}</td>
          <td style="padding:10px 8px; text-align:center;">${item.quantity}</td>
          <td style="padding:10px 8px; text-align:right;">${Number(item.unit_price).toFixed(2)}</td>
          <td style="padding:10px 8px; text-align:right; font-weight:500;">${Number(item.amount).toFixed(2)}</td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
  }

  html += `
      <div style="display:flex; gap:12px; margin-top:24px; flex-wrap:wrap;">
        <button onclick="changeVoStatus('${vo.id}', 'adjusting')" class="btn-secondary" style="width:auto; background:#f59e0b; color:white;">
          Mark as Adjusting
        </button>
        <button onclick="changeVoStatus('${vo.id}', 'approved')" class="btn-secondary" style="width:auto; background:#10b981; color:white;">
          Mark as Approved
        </button>
        <button onclick="closeVoView()" class="btn-secondary" style="width:auto;">Close</button>
      </div>
    </div>
  `;

  const container = document.getElementById("vo-view-container");
  container.classList.remove("hidden");
  container.innerHTML = html;
  container.scrollIntoView({ behavior: "smooth" });
}

function closeVoView() {
  const container = document.getElementById("vo-view-container");
  container.classList.add("hidden");
  container.innerHTML = "";

  if (currentProjectId) {
    loadQuotations(currentProjectId);
    loadVos(currentProjectId);
    updateContractSummary(currentProjectId);
  }
}

async function changeVoStatus(voId, newStatus) {
  if (!confirm(`Change VO status to "${newStatus.toUpperCase()}"?`)) return;

  const { error } = await supabaseClient
    .from("variation_orders")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
      approved_at: newStatus === "approved" ? new Date().toISOString() : null
    })
    .eq("id", voId);

  if (error) {
    alert("Failed to update status: " + error.message);
    return;
  }

  alert(`VO status changed to ${newStatus.toUpperCase()}`);

const viewContainer = document.getElementById("vo-view-container");
viewContainer.classList.add("hidden");
viewContainer.innerHTML = "";

await loadVos(currentProjectId);
await updateContractSummary(currentProjectId);
}


// ====================== DELETE & EDIT ======================

async function deleteQuotation(id) {
  if (!confirm("Are you sure you want to delete this quotation?\nThis action cannot be undone.")) return;

  try {
    // 1. Delete all items first
    const { error: itemsError } = await supabaseClient
      .from("quotation_items")
      .delete()
      .eq("quotation_id", id);

    if (itemsError) {
      console.error("Items delete error:", itemsError);
      throw itemsError;
    }

    // 2. Delete the quotation
    const { error } = await supabaseClient
      .from("quotations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Quotation delete error:", error);
      throw error;
    }

    alert("Quotation deleted successfully");
    loadQuotations(currentProjectId);

  } catch (err) {
    console.error(err);
    alert("Delete failed: " + err.message);
  }
}

async function deleteVo(id) {
  if (!confirm("Are you sure you want to delete this Variation Order?\nThis cannot be undone.")) return;

  try {
    // Delete items first
    const { error: itemsError } = await supabaseClient
      .from("vo_items")
      .delete()
      .eq("vo_id", id);

    if (itemsError) throw itemsError;

    // Delete the VO
    const { error } = await supabaseClient
      .from("variation_orders")
      .delete()
      .eq("id", id);

    if (error) throw error;

    alert("VO deleted successfully");
    
    // Force reload the list
    if (currentProjectId) {
      await loadVos(currentProjectId);
      // After loadQuotations and loadVos
await updateContractSummary(currentProjectId);
    }
  } catch (err) {
    console.error(err);
    alert("Delete failed: " + err.message);
  }
}

async function editVo(voId) {
  currentVoId = voId;

  const { data: vo, error } = await supabaseClient
    .from("variation_orders")
    .select("*")
    .eq("id", voId)
    .single();

  if (error) return alert("Failed to load VO");

  const { data: items, error: itemsError } = await supabaseClient
    .from("vo_items")
    .select("*")
    .eq("vo_id", voId)
    .order("sort_order");

  if (itemsError) return alert("Failed to load items");

    openVoForm(vo);
  document.getElementById("vo-items-body").innerHTML = "";

  if (items && items.length > 0) {
    items.forEach(item => addVoItemRow(item));
  } else {
    addVoItemRow();
  }

  updateVoTotal();
}


async function editQuotation(quotationId) {
  const { data: quotation, error } = await supabaseClient
    .from("quotations")
    .select("*")
    .eq("id", quotationId)
    .single();

  if (error) {
    alert("Failed to load quotation: " + error.message);
    return;
  }

  const { data: items, error: itemsError } = await supabaseClient
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("sort_order");

  if (itemsError) {
    alert("Failed to load quotation items: " + itemsError.message);
    return;
  }

  currentQuotationId = quotationId;
  document.getElementById("quotation-form-title").textContent =
    `Edit ${quotation.quotation_no || "Quotation"} v${quotation.version_no}`;
  document.getElementById("quotation-prepared-by").value =
    quotation.prepared_by || "";
  document.getElementById("quotation-notes").value =
    quotation.notes || "";

  const container = document.getElementById("quotation-form-container");
  container.classList.remove("hidden");

  const tbody = document.getElementById("items-body");
  tbody.innerHTML = "";

  (items || []).forEach(item => addItemRow(item));
  if (!items || items.length === 0) addItemRow();

  updateQuotationTotal();
  container.scrollIntoView({ behavior: "smooth" });
}


// ====================== Update Contract Summary ======================

async function updateContractSummary(projectId) {
  const { data: quotations, error: qError } = await supabaseClient
    .from("quotations")
    .select("id, total_amount, status, version_no, quotation_no")
    .eq("project_id", projectId)
    .order("version_no", { ascending: false });

  if (qError) {
    console.error("Failed to load quotations for summary:", qError);
    return;
  }

  let originalAmount = 0;
  let originalLabel = "No quotation yet";

  if (quotations && quotations.length > 0) {
    const approvedQuotation = quotations.find(q => q.status === "approved");
    const selectedQuotation = approvedQuotation || quotations[0];

    originalAmount = Number(selectedQuotation.total_amount) || 0;
    originalLabel = `${selectedQuotation.quotation_no || ""} v${selectedQuotation.version_no} (${selectedQuotation.status})`;
  }

  const { data: vos, error: vError } = await supabaseClient
    .from("variation_orders")
    .select("total_amount, vo_number, title, status")
    .eq("project_id", projectId)
    .eq("status", "approved");

  if (vError) {
    console.error("Failed to load approved VOs for summary:", vError);
    return;
  }

  const voTotal = (vos || []).reduce(
    (sum, vo) => sum + (Number(vo.total_amount) || 0),
    0
  );
  const contractValue = originalAmount + voTotal;

  const originalEl = document.getElementById("summary-original");
  const voEl = document.getElementById("summary-vo");
  const totalEl = document.getElementById("summary-total");
  const approvedListEl = document.getElementById("summary-approved-vos");

  if (originalEl) {
    originalEl.innerHTML = `
      <span style="font-size:1.3rem; font-weight:700;">RM ${originalAmount.toFixed(2)}</span>
      <br><small style="font-size:0.75rem; color:#64748b;">${originalLabel}</small>
    `;
  }

  if (voEl) {
    voEl.innerHTML = `
      <span style="font-size:1.3rem; font-weight:700; color:#0ea5e9;">RM ${voTotal.toFixed(2)}</span>
      <br><small style="font-size:0.75rem; color:#64748b;">${vos.length} approved VO(s)</small>
    `;
  }

  if (approvedListEl) {
    approvedListEl.innerHTML = `
      <h4 style="margin-bottom:8px;">Approved Variation Orders</h4>
      ${
        vos.length
          ? `<ul style="padding-left:20px;">
              ${vos.map(vo => `
                <li>${vo.vo_number || "VO"} — ${vo.title || "Variation Order"}:
                  RM ${Number(vo.total_amount || 0).toFixed(2)}
                </li>
              `).join("")}
            </ul>`
          : "<p>No approved variation orders yet.</p>"
      }
    `;
  }

  if (totalEl) {
    totalEl.textContent = "RM " + contractValue.toFixed(2);
  }
}
