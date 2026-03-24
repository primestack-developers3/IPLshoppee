// order-manager.js
// Utility functions for order management

/**
 * Order Management Utilities
 * Used for managing orders across the application
 */

class OrderManager {
  constructor(apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000') {
    this.apiBase = apiBase;
  }

  /**
   * Create a Razorpay order
   */
  async createPaymentOrder(amount) {
    try {
      const response = await fetch(`${this.apiBase}/api/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency: 'INR',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment order');
      }

      return await response.json();
    } catch (error) {
      console.error('Create order error:', error);
      throw error;
    }
  }

  /**
   * Save order after successful payment
   */
  async saveOrder(orderData) {
    try {
      const response = await fetch(`${this.apiBase}/api/save-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        throw new Error('Failed to save order');
      }

      return await response.json();
    } catch (error) {
      console.error('Save order error:', error);
      throw error;
    }
  }

  /**
   * Fetch all orders
   */
  async getOrders() {
    try {
      const response = await fetch(`${this.apiBase}/api/get-orders`);

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      return await response.json();
    } catch (error) {
      console.error('Get orders error:', error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId, status) {
    try {
      const response = await fetch(`${this.apiBase}/api/update-order-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          status,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update order status');
      }

      return await response.json();
    } catch (error) {
      console.error('Update status error:', error);
      throw error;
    }
  }

  /**
   * Process refund
   */
  async refundPayment(orderId, paymentId, amount) {
    try {
      const response = await fetch(`${this.apiBase}/api/refund-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          paymentId,
          amount,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process refund');
      }

      return await response.json();
    } catch (error) {
      console.error('Refund error:', error);
      throw error;
    }
  }

  /**
   * Get status badge color (for UI)
   */
  getStatusColor(status) {
    const colors = {
      NEW: 'blue',
      ORDERED: 'purple',
      SHIPPED: 'green',
      REFUNDED: 'red',
    };
    return colors[status] || 'gray';
  }

  /**
   * Get status badge text
   */
  getStatusText(status) {
    const texts = {
      NEW: 'New Order',
      ORDERED: 'Ordered',
      SHIPPED: 'Shipped',
      REFUNDED: 'Refunded',
    };
    return texts[status] || status;
  }

  /**
   * Format currency (Indian Rupees)
   */
  formatCurrency(amount) {
    return `₹${amount.toLocaleString('en-IN')}`;
  }

  /**
   * Format date to Indian timezone
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Copy error:', error);
      return false;
    }
  }

  /**
   * Build order details string for Meesho ordering
   */
  buildOrderDetailsString(order) {
    const details = [
      `📦 Order #${order.id.slice(0, 8).toUpperCase()}`,
      ``,
      `👤 Name: ${order.customer.name}`,
      `📞 Phone: ${order.customer.phone}`,
      `📍 Address: ${order.customer.address}`,
      ``,
      `Products:`,
      ...order.products.map(p => `- ${p.name} (Qty: ${p.quantity}) - ₹${p.price * p.quantity}`),
      ``,
      `Total: ${this.formatCurrency(order.totalAmount)}`,
    ].join('\n');

    return details;
  }
}

// Export as global if not in module environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OrderManager;
} else {
  window.OrderManager = OrderManager;
}
