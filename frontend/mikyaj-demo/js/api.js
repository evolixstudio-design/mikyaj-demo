/* Mikyaj API Client */
const MikyajAPI = {
  // Use localhost:3000 for local development, otherwise fallback to production backend.
  // Using relative path '/api' assumes frontend and backend are served together or via a proxy (like Netlify _redirects).
  BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? (window.location.port === '3000' ? '/api' : 'http://localhost:3000/api') 
    : '/api',
  
  watermark(url) {
    if (!url || typeof url !== 'string' || !url.includes('cloudinary.com/')) return url;
    return url.replace('/image/upload/', '/image/upload/l_mikyaj_logo,w_100,g_north_west,x_20,y_20,o_80/');
  },
  async fetchJson(endpoint) {
    try {
      const res = await fetch(`${this.BASE_URL}${endpoint}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`API Error: ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error('MikyajAPI Error:', err);
      MikyajApp.showToast('Unable to connect to server.', 'error');
      return null;
    }
  },

  async adminFetch(endpoint, options = {}) {
    const session = JSON.parse(localStorage.getItem('mikyaj_admin_session') || 'null');
    if (!session || !session.token) {
      window.location.href = 'login.html';
      throw new Error('Not authenticated');
    }

    const headers = {
      'Authorization': `Bearer ${session.token}`,
      ...options.headers
    };

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    try {
      const res = await fetch(`${this.BASE_URL}${endpoint}`, {
        ...options,
        headers
      });

      if (res.status === 401) {
        localStorage.removeItem('mikyaj_admin_session');
        window.location.href = 'login.html';
        throw new Error('Session expired');
      }

      let data = null;
      if (res.status !== 204) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await res.json();
        }
      }

      if (!res.ok) {
        const errorMsg = data && data.error ? data.error : `API Error: ${res.status}`;
        const err = new Error(errorMsg);
        err.status = res.status;
        throw err;
      }

      return data;
    } catch (err) {
      console.error('Admin API Error:', err);
      throw err;
    }
  },

  async driverFetch(endpoint, options = {}) {
    const session = JSON.parse(localStorage.getItem('mikyaj_driver_session') || 'null');
    if (!session || !session.token) {
      window.location.href = 'login.html';
      throw new Error('Not authenticated');
    }

    const headers = {
      'Authorization': `Bearer ${session.token}`,
      ...options.headers
    };

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    try {
      const res = await fetch(`${this.BASE_URL}${endpoint}`, {
        ...options,
        headers
      });

      if (res.status === 401) {
        localStorage.removeItem('mikyaj_driver_session');
        window.location.href = 'login.html';
        throw new Error('Session expired');
      }
      
      if (res.status === 403) {
        // Driver might be inactive, clear session if it's an auth level 403,
        // but it might also be just order ownership 403. We let the caller handle 403 usually,
        // or check message. For safety, let's just throw it.
      }

      let data = null;
      if (res.status !== 204) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await res.json();
        }
      }

      if (!res.ok) {
        const errorMsg = data && data.error ? data.error : `API Error: ${res.status}`;
        const err = new Error(errorMsg);
        err.status = res.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (err) {
      console.error('Driver API Error:', err);
      throw err;
    }
  },

  async getProducts(params = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.append('limit', params.limit);
    if (params.cursor) query.append('cursor', params.cursor);
    if (params.search) query.append('search', params.search);
    if (params.category) query.append('category', params.category);
    if (params.brand) query.append('brand', params.brand);
    if (params.minPrice) query.append('min_price', params.minPrice);
    if (params.maxPrice) query.append('max_price', params.maxPrice);

    return await this.fetchJson(`/products?${query.toString()}`);
  },

  async getProduct(slug) {
    return await this.fetchJson(`/products/${slug}`);
  },

  async getCategories() {
    return await this.fetchJson('/categories');
  },

  async getBrands() {
    return await this.fetchJson('/brands');
  }
};
