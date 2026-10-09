// Check if user is already logged in
async function checkUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

// Login function
async function login(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    alert("Login failed: " + error.message);
    console.error(error);
    return null;
  }
  return data.user;
}

// Register function
async function register(email, password, fullName) {
  const { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (error) {
    alert("Register failed: " + error.message);
    console.error(error);
    return null;
  }

  if (data.user && data.user.identities && data.user.identities.length === 0) {
    alert("This email is already registered.");
    return null;
  }

  return data.user;
}

// Logout
async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}