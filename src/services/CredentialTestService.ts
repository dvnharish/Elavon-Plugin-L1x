import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export interface TestCredentials {
  merchantId: string;
  apiKey: string;
  apiSecret: string;
  apiUrl: string;
}

export interface TestResult {
  success: boolean;
  message: string;
  responseTime?: number;
  statusCode?: number;
}

interface HttpResponse {
  status: number;
  data: string;
}

export class CredentialTestService {
  
  /**
   * Test API credentials by making a health check request
   */
  async testCredentials(credentials: TestCredentials): Promise<TestResult> {
    try {
      const startTime = Date.now();
      
      // First try the health endpoint (no auth required)
      const healthUrl = `${credentials.apiUrl}/health`;
      
      const healthResponse = await this.makeRequest(healthUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'L1X-ElavonX-Migrator/1.0'
        }
      });
      
      if (healthResponse.status === 200) {
        // Health check passed, now try an authenticated endpoint
        const authResult = await this.testAuthentication(credentials);
        const responseTime = Date.now() - startTime;
        
        return {
          success: authResult.success,
          message: authResult.success 
            ? `✓ Connection successful (${responseTime}ms)` 
            : `✗ Authentication failed: ${authResult.message}`,
          responseTime,
          statusCode: authResult.statusCode || healthResponse.status
        };
      } else {
        return {
          success: false,
          message: `✗ API endpoint unreachable (HTTP ${healthResponse.status})`,
          statusCode: healthResponse.status
        };
      }
      
    } catch (error) {
      return {
        success: false,
        message: `✗ Connection failed: ${this.getErrorMessage(error)}`
      };
    }
  }
  
  /**
   * Test authentication by trying to access a protected endpoint
   */
  private async testAuthentication(credentials: TestCredentials): Promise<TestResult> {
    try {
      // Try to access the merchants endpoint (requires authentication)
      const merchantsUrl = `${credentials.apiUrl}/merchants`;
      
      // Create basic auth header
      const authString = Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString('base64');
      
      const response = await this.makeRequest(merchantsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json',
          'Accept-Version': '1',
          'User-Agent': 'L1X-ElavonX-Migrator/1.0'
        }
      });
      
      if (response.status === 200) {
        return {
          success: true,
          message: 'Authentication successful',
          statusCode: response.status
        };
      } else if (response.status === 401) {
        return {
          success: false,
          message: 'Invalid API credentials',
          statusCode: response.status
        };
      } else if (response.status === 403) {
        return {
          success: false,
          message: 'Access forbidden - check API key permissions',
          statusCode: response.status
        };
      } else {
        return {
          success: false,
          message: `Unexpected response (HTTP ${response.status})`,
          statusCode: response.status
        };
      }
      
    } catch (error) {
      return {
        success: false,
        message: this.getErrorMessage(error)
      };
    }
  }
  
  /**
   * Make HTTP request with timeout using Node.js built-in modules
   */
  private async makeRequest(url: string, options: any): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: 10000 // 10 second timeout
      };
      
      const req = httpModule.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            data: data
          });
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.end();
    });
  }
  
  /**
   * Extract meaningful error message from various error types
   */
  private getErrorMessage(error: any): string {
    if (error.name === 'AbortError') {
      return 'Request timeout (10s)';
    }
    
    if (error.code === 'ENOTFOUND') {
      return 'DNS resolution failed - check URL';
    }
    
    if (error.code === 'ECONNREFUSED') {
      return 'Connection refused - service may be down';
    }
    
    if (error.code === 'ETIMEDOUT') {
      return 'Connection timeout';
    }
    
    if (error.message) {
      return error.message;
    }
    
    return 'Unknown error occurred';
  }
}