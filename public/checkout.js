let cart = {};
console.log("checkout.js loaded");

function updateQuantity(id, change) {
    const el = document.getElementById(`quantity-${id}`);
    let qty = parseInt(el.innerText) + change;
    if (qty < 0) qty = 0;
    el.innerText = qty;
    cart[id] = qty;

    displayCart();
}

function displayCart() {
    const items = Object.entries(cart).filter(i => i[1] > 0);
    const cartDiv = document.getElementById("cartSummary");
    const cartItemsDiv = document.getElementById("cartItems");
    const cartTotalSpan = document.getElementById("cartTotal");

    if (items.length === 0) {
        cartDiv.style.display = "none";
        return;
    }

    cartDiv.style.display = "block";
    cartItemsDiv.innerHTML = "";
    let total = 0;

    items.forEach(([id, quantity]) => {
        const itemBox = document.querySelector(`[data-item-id="${id}"]`);
        const price = parseFloat(itemBox.querySelector(".price").innerText.replace("$", "")) * quantity;
        total += price;

        cartItemsDiv.innerHTML += `<p>${id} × ${quantity} — $${price.toFixed(2)}</p>`;
    });

    cartTotalSpan.innerText = total.toFixed(2);
}

async function proceedToCheckout() {
    console.log("Proceed clicked");

    const items = Object.entries(cart)
        .filter(([id, qty]) => qty > 0)
        .map(([id, qty]) => ({ id, quantity: qty }));

    const res = await fetch("/api/create-payment-intent", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ items })
    });

    const data = await res.json();

    window.location.href = `/checkout.html?payment_intent_client_secret=${data.clientSecret}`;
}
