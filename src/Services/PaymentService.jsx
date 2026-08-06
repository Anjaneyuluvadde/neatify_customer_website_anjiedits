import { supabase } from "../components/supabaseClient";

/* ================= CREATE ORDER ================= */
export const createOrder = async (amount, bookingId) => {
  try {
    const cleanAmount = parseFloat(amount);

    console.log("createOrder: Calling edge function via invoke()...");
    const { data, error: invokeError } = await supabase.functions.invoke("create-razorpay-order", {
      body: {
        booking_id: bookingId,
        amount: cleanAmount,
      },
      headers: {
        Authorization: "", // Force unauthenticated request to bypass gateway 401 for guests
      }
    });

    if (invokeError) {
      console.error("createOrder invoke error:", invokeError);
      throw new Error(`Edge Function Error: ${invokeError.message || "Unknown error"}`);
    }

    if (!data || !data.order_id) {
      console.error("createOrder: Missing order_id in response:", data);
      throw new Error("INVALID_ORDER_RESPONSE");
    }

    return {
      id: data.order_id,
      amount: data.amount,
      currency: data.currency,
      key: data.key || process.env.REACT_APP_RAZORPAY_KEY,
    };
  } catch (err) {
    console.error("createOrder Exception:", err.message);
    throw err;
  }
};

/* ================= VERIFY PAYMENT ================= */
export const verifyPayment = async (paymentDetails) => {
  try {
    console.log("verifyPayment: Calling edge function via invoke()...");
    const { data, error } = await supabase.functions.invoke("verify-payment", {
      body: {
        razorpay_order_id: paymentDetails.razorpay_order_id,
        razorpay_payment_id: paymentDetails.razorpay_payment_id,
        razorpay_signature: paymentDetails.razorpay_signature,
        booking_id: paymentDetails.booking_id,
      },
      headers: {
        Authorization: "", // Force unauthenticated request
      }
    });

    if (error) {
      console.error("verifyPayment invoke error:", error);
      throw new Error(error.message || "VERIFICATION_FAILED");
    }

    if (!data || data.success === false) {
      console.error("verifyPayment logic error:", data);
      throw new Error(data?.message || "VERIFICATION_FAILED");
    }

    return data;
  } catch (err) {
    console.error("verifyPayment Exception:", err.message);
    throw err;
  }
};

/* ================= LOAD RAZORPAY SDK ================= */
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/* ================= PROCESS PAYMENT ================= */
export const processPayment = async (
  amount,
  userDetails = {},
  bookingId
) => {
  try {
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      return { success: false, error: "SDK_LOAD_FAILED" };
    }

    const order = await createOrder(amount, bookingId);

    return new Promise((resolve) => {
      const options = {
        key: order.key,
        amount: order.amount,
        currency: "INR",
        name: "The Neatify Team",
        order_id: order.id,

        prefill: {
          name: `${userDetails.firstName || ""} ${userDetails.lastName || ""}`.trim(),
          email: userDetails.email || "",
          contact: userDetails.phone || "",
        },

        notes: {
          booking_id: bookingId,
        },

        handler: async (response) => {
          try {
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              booking_id: bookingId,
            });

            resolve({
              success: true,
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
            });
          } catch (err) {
            resolve({
              success: false,
              error: "VERIFICATION_FAILED",
            });
          }
        },

        modal: {
          ondismiss: () => {
            resolve({ success: false, error: "DISMISSED" });
          },
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on("payment.failed", (response) => {
        resolve({
          success: false,
          error: response.error?.description || "PAYMENT_FAILED",
        });
      });

      razorpay.open();
    });
  } catch (err) {
    console.error("Process payment error:", err);
    return { success: false, error: err.message || "PROCESS_PAYMENT_ERROR" };
  }
};

