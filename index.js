function alpineInstance() {
  return {
    apiVersion: '0.1.0',
    currentTab: location.hash.replace('#','') || 'usage',
    currentPanel: '',
    alertError: '',
    waiting: [],
    filter: '',
    cache: {},
    error: {},
    initialize() {
      this.apiGetJson("/api/version");
      this.refresh();
    },
    refresh() {
      this.apiGetJson("/api/status");
      this.apiGetText("/api/log");
      this.apiGetJson("/api/config");
      this.apiGetJson("/api/runtime");
      this.apiGetJson("/api/accesskeys");
      this.apiGetJson("/api/relays");
      this.apiGetJson("/api/contract");
      this.apiGetJson("/api/forwarders/socks");
      this.apiGetText("/api/forwarders/socks/log");
      this.apiGetJson("/api/forwarders/tun");
      this.apiGetText("/api/forwarders/tun/log");
    },
    running() {
      if (this.cache.forwarders_socks) {
        if (this.cache.forwarders_socks.state == 'active') {
          this.updateFavicon(true);
          return true;
        }
      }
      if (this.cache.forwarders_tun) {
        if (this.cache.forwarders_tun.state == 'active') {
          this.updateFavicon(true);
          return true;
        }
      }
      this.updateFavicon(false);
      return false;
    },
    apiPostJson(uri, data={}) {
      this.waiting.push(uri);
      let options = { method: 'POST', headers: {'Content-Type': 'applications/json'}, body: JSON.stringify(data) };
      fetch(uri, options)
        .then(response => {
          if (response.ok) return response.json();
          throw response;
        })
        .then(data => {
          this.apiGetText("/api/log");
          if (uri.startsWith("/api/forwarders/socks")) {
            this.cache.forwarders_socks = data;
            this.apiGetText("/api/forwarders/socks/log");
          }
          if (uri.startsWith("/api/forwarders/tun")) {
            this.cache.forwarders_tun = data;
            this.apiGetText("/api/forwarders/tun/log");
          }
          if (uri.startsWith("/api/config")) {
            this.cache.config = data;
          }
          if (uri.startsWith("/api/reload")) {
            //TODO: this.cache.status = data;
            this.apiGetJson("/api/status");
          }
          if (uri.startsWith("/api/accesskeys")) {
            this.apiGetJson("/api/accesskeys");
          }
        })
        .catch(error => {
          console.log(error);
          error.text().then(data => this.alertError = data);
        })
        .finally(() => {
          this.waiting.pop(uri);
        });
    },
    apiGetJson(uri) {
      this.waiting.push(uri);
      let cacheKey = uri.replaceAll("/","_").replace('_api_','');
      fetch(uri)
        .then(response => {
          if (response.ok) return response.json();
          throw response;
        })
        .then(data => {
          this.cache[cacheKey] = data;
          this.error[cacheKey] = null;
        })
        .catch(error => {
          this.cache[cacheKey] = null;
          error.text().then(data => this.error[cacheKey] = data );
        })
        .finally(() => {
          this.waiting.pop(uri);
        });
    },
    apiGetText(uri) {
      this.waiting.push(uri);
      let cacheKey = uri.replaceAll("/","_").replace('_api_','');
      fetch(uri)
        .then(response => {
          if (response.ok) return response.text();
          throw response;
        })
        .then(data => {
          this.cache[cacheKey] = data;
          this.error[cacheKey] = null;
        })
        .catch(error => {
          this.cache[cacheKey] = null;
          error.text().then(data => this.error[cacheKey] = data );
        })
        .finally(() => {
          this.waiting.pop(uri);
        });
    },
    maxHops() {
      if (!this.cache.relays) return 0;
      if (this.filterBy(this.cache.relays, 'role', 'backing').length == 0) return 0;
      if (this.filterBy(this.cache.relays, 'role', 'fronting').length == 0) return 1;
      if (this.filterBy(this.cache.relays, 'role', 'entropic').length == 0) return 2;
      return this.filterBy(this.cache.relays, 'role', 'entropic').length + 2;
    },
    whitelistRoleCount(whitelist, role) {
      if (!this.cache.relays) return 0;
      let roles = this.cache.relays.filter(relay => whitelist.includes(relay.address)).map(relay => relay.role);
      return roles.filter(r => r == role).length;
    },
    isWhitelistRoleValid(whitelist, hops, role) {
      if ((role == 'backing') && (hops >= 1) && (this.whitelistRoleCount(whitelist, role) < 1)) return false;
      if ((role == 'fronting') && (hops >= 2) && (this.whitelistRoleCount(whitelist, role) < 1)) return false;
      if ((role == 'entropic') && (hops >= 3) && (this.whitelistRoleCount(whitelist, role) < hops - 2)) return false;
      return true;
    },
    isWhitelistValid(whitelist, hops) {
      if (whitelist.length == 0) return true;
      if (!this.isWhitelistRoleValid(whitelist, hops, 'backing')) return false;
      if (!this.isWhitelistRoleValid(whitelist, hops, 'fronting')) return false;
      if (!this.isWhitelistRoleValid(whitelist, hops, 'entropic')) return false;
      return true;
    },
    filterBy(collection, key, value) {
      return collection.filter(
        entry => entry[key] == value
      );
    },
    filterRelays() {
      if (!this.cache.relays) return {}
      return this.cache.relays.filter(
        relay => relay.address.toLowerCase().includes(this.filter.toLowerCase())
      );
    },
    filterHighlight(s) {
      if (this.filter === '') return s;
      return s.replaceAll(new RegExp(`(${this.filter.toLowerCase()})`, 'ig'), '<span class="font-bold">$1</span>')
    },
    osSlash() {
      if (!this.cache.runtime) return;
      return this.cache.runtime.platform.os == 'windows' ? '\\' : '/';
    },
    arraysEqual(arrOne, arrTwo) {
      return arrOne.length === arrTwo.length && arrOne.every(function (element) { return arrTwo.includes(element); });
    },
    timeLeft(seconds) {
      if (seconds < 1) return "0 seconds";
      var d = Math.floor(seconds / (3600*24));
      var h = Math.floor(seconds % (3600*24) / 3600);
      var m = Math.floor(seconds % 3600 / 60);
      var s = Math.floor(seconds % 60);

      var dDisplay = d > 0 ? d + (d == 1 ? " day" : " days") : "";
      var hDisplay = h > 0 ? h + (h == 1 ? " hour" : " hours") : "";
      var mDisplay = m > 0 ? m + (m == 1 ? " minute" : " minutes") : "";
      var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";

      if (d > 0) return (dDisplay + ", " + hDisplay).replace(/,\s*$/, '');
      if (h > 0) return (hDisplay + ", " + mDisplay).replace(/,\s*$/, '');
      if (m > 0) return (mDisplay + ", " + sDisplay).replace(/,\s*$/, '');
      return sDisplay
    },
    epochToDate(timestamp) {
      let exp = new Date(timestamp * 1000);
      return String(exp).split(" (")[0];
    },
    epochToTimeLeft(timestamp) {
      now = new Date();
      now_unix = Math.floor(now.getTime() / 1000);
      seconds = timestamp - now_unix;
      return this.timeLeft(seconds)
    },
    updateFavicon(active) {
      const iconActive = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='100' width='100'%3E%3Ccircle cx='50' cy='50' r='40' fill='%2322c55e' /%3E%3C/svg%3E%0A"
      const iconInActive = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='100' width='100'%3E%3Ccircle cx='50' cy='50' r='40' fill='gray' /%3E%3C/svg%3E%0A"
      const favicon = document.getElementById("favicon");
      favicon.href = active ? iconActive : iconInActive;
    },

  }
}
