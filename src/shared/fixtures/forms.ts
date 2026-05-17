export const SIMPLE_US_FORM = `
  <form id="checkout">
    <label for="first-name">First name</label>
    <input
      id="first-name"
      name="firstName"
      autocomplete="given-name"
      placeholder="First name"
      value="do-not-send"
    />

    <label for="last-name">Last name</label>
    <input id="last-name" name="lastName" autocomplete="family-name" />

    <label for="street">Street address</label>
    <input id="street" name="address1" autocomplete="address-line1" />

    <label for="city">City</label>
    <input id="city" name="city" autocomplete="address-level2" />

    <label for="state">State</label>
    <select id="state" name="state" autocomplete="address-level1">
      <option value="">Select a state</option>
      <option value="DE">Delaware</option>
      <option value="OR">Oregon</option>
    </select>

    <label for="zip">ZIP code</label>
    <input id="zip" name="zip" autocomplete="postal-code" />

    <label for="card-number">Card number</label>
    <input id="card-number" name="cardNumber" autocomplete="cc-number" />

    <label for="account-password">Account password</label>
    <input id="account-password" name="password" type="password" />
  </form>
`;
