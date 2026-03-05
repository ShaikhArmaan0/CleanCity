/* contact.ui.js — Contact page form with real backend */

async function submitContact() {
  const name = document.getElementById("ctName").value.trim();
  const email = document.getElementById("ctEmail").value.trim();
  const subject = document.getElementById("ctSubject").value;
  const message = document.getElementById("ctMessage").value.trim();

  // Validate
  if (!name) {
    highlight("ctName");
    Toast.show("Please enter your name", "warning");
    return;
  }
  if (!email || !email.includes("@")) {
    highlight("ctEmail");
    Toast.show("Please enter a valid email", "warning");
    return;
  }
  if (!subject) {
    highlight("ctSubject");
    Toast.show("Please select a subject", "warning");
    return;
  }
  if (!message) {
    highlight("ctMessage");
    Toast.show("Please write a message", "warning");
    return;
  }

  const btn = document.getElementById("ctSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Sending…";

  try {
    await fetch(API.contact, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, subject, message }),
    }).then(async (r) => {
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "Failed to send");
      }
      return r.json();
    });

    // Success
    document.getElementById("contactForm").style.display = "none";
    document.getElementById("formSuccess").style.display = "block";
  } catch (err) {
    Toast.show(
      err.message || "Could not send message. Please try again.",
      "error",
    );
    btn.disabled = false;
    btn.textContent = "Send Message →";
  }
}
window.submitContact = submitContact;

function highlight(id) {
  const el = document.getElementById(id);
  el.classList.add("error");
  el.focus();
  setTimeout(() => el.classList.remove("error"), 2000);
}
