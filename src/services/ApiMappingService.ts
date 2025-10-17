import { Logger } from '../utils/logger';
import { OpenApiService } from './OpenApiService';
import { FieldMappingService, FieldMapping, MappingGroup } from './FieldMappingService';

export interface ApiMapping {
  convergeEndpoint: string;
  elavonEndpoint: string;
  confidence: number;
  mappingType: 'exact' | 'similar' | 'inferred';
  fieldMappings: FieldMapping[];
  transformationRequired: boolean;
  migrationNotes: string[];
}

export interface VariableMapping {
  convergeVariable: string;
  elavonVariable: string;
  type: 'credential' | 'parameter' | 'response_field';
  confidence: number;
  description: string;
  example?: string;
}

export interface EndpointMapping {
  converge: {
    path: string;
    method: string;
    description: string;
  };
  elavon: {
    path: string;
    method: string;
    description: string;
  };
  confidence: number;
  notes: string[];
}

export class ApiMappingService {
  private openApiService: OpenApiService;
  private fieldMappingService: FieldMappingService;
  private mappingCache = new Map<string, ApiMapping[]>();
  
  // Pre-defined mappings for common Converge to Elavon patterns
  private readonly VARIABLE_MAPPINGS: VariableMapping[] = [
    {
      convergeVariable: 'ssl_merchant_id',
      elavonVariable: 'merchantId',
      type: 'credential',
      confidence: 1.0,
      description: 'Merchant identifier for authentication',
      example: 'ssl_merchant_id="12345" → merchantId: "12345"'
    },
    {
      convergeVariable: 'ssl_user_id',
      elavonVariable: 'userId',
      type: 'credential',
      confidence: 1.0,
      description: 'User identifier for authentication',
      example: 'ssl_user_id="user123" → userId: "user123"'
    },
    {
      convergeVariable: 'ssl_pin',
      elavonVariable: 'apiKey',
      type: 'credential',
      confidence: 0.9,
      description: 'Authentication PIN/API Key',
      example: 'ssl_pin="secret" → apiKey: "secret"'
    },
    {
      convergeVariable: 'ssl_amount',
      elavonVariable: 'amount',
      type: 'parameter',
      confidence: 1.0,
      description: 'Transaction amount',
      example: 'ssl_amount="10.00" → amount: "10.00"'
    },
    {
      convergeVariable: 'ssl_card_number',
      elavonVariable: 'cardNumber',
      type: 'parameter',
      confidence: 1.0,
      description: 'Credit card number',
      example: 'ssl_card_number="4111111111111111" → cardNumber: "4111111111111111"'
    },
    {
      convergeVariable: 'ssl_exp_date',
      elavonVariable: 'expirationDate',
      type: 'parameter',
      confidence: 1.0,
      description: 'Card expiration date',
      example: 'ssl_exp_date="1225" → expirationDate: "12/25"'
    },
    {
      convergeVariable: 'ssl_cvv2cvc2',
      elavonVariable: 'securityCode',
      type: 'parameter',
      confidence: 1.0,
      description: 'Card security code',
      example: 'ssl_cvv2cvc2="123" → securityCode: "123"'
    },
    {
      convergeVariable: 'ssl_transaction_type',
      elavonVariable: 'transactionType',
      type: 'parameter',
      confidence: 0.9,
      description: 'Type of transaction (sale, auth, etc.)',
      example: 'ssl_transaction_type="ccsale" → transactionType: "sale"'
    },
    {
      convergeVariable: 'ssl_result',
      elavonVariable: 'state',
      type: 'response_field',
      confidence: 0.8,
      description: 'Transaction result status',
      example: 'ssl_result="0" → state: "authorized"'
    },
    {
      convergeVariable: 'ssl_txn_id',
      elavonVariable: 'transactionId',
      type: 'response_field',
      confidence: 1.0,
      description: 'Unique transaction identifier',
      example: 'ssl_txn_id="12345" → transactionId: "12345"'
    }
  ];

  private readonly ENDPOINT_MAPPINGS: EndpointMapping[] = [
    {
      converge: {
        path: '/api/converge/sale',
        method: 'POST',
        description: 'Process a credit card sale transaction'
      },
      elavon: {
        path: '/transactions',
        method: 'POST',
        description: 'Create a new transaction (sale)'
      },
      confidence: 0.95,
      notes: [
        'Converge sale endpoint maps to Elavon transactions endpoint',
        'Set doCapture: true for immediate capture',
        'Use card object for payment details'
      ]
    },
    {
      converge: {
        path: '/api/converge/auth',
        method: 'POST',
        description: 'Authorize a credit card transaction'
      },
      elavon: {
        path: '/transactions',
        method: 'POST',
        description: 'Create a new transaction (authorization only)'
      },
      confidence: 0.95,
      notes: [
        'Converge auth endpoint maps to Elavon transactions endpoint',
        'Set doCapture: false for authorization only',
        'Use card object for payment details'
      ]
    },
    {
      converge: {
        path: '/api/converge/refund',
        method: 'POST',
        description: 'Process a refund transaction'
      },
      elavon: {
        path: '/transactions',
        method: 'POST',
        description: 'Create a refund transaction'
      },
      confidence: 0.9,
      notes: [
        'Converge refund endpoint maps to Elavon transactions endpoint',
        'Set type: "refund" in transaction object',
        'Reference original transaction ID'
      ]
    },
    {
      converge: {
        path: '/api/converge/void',
        method: 'POST',
        description: 'Void a previous transaction'
      },
      elavon: {
        path: '/transactions/{id}',
        method: 'POST',
        description: 'Update transaction to void status'
      },
      confidence: 0.85,
      notes: [
        'Converge void maps to Elavon transaction update',
        'Use transaction ID in URL path',
        'Set appropriate void parameters'
      ]
    },
    {
      converge: {
        path: '/api/converge/capture',
        method: 'POST',
        description: 'Capture a previously authorized transaction'
      },
      elavon: {
        path: '/transactions/{id}',
        method: 'POST',
        description: 'Update transaction to capture'
      },
      confidence: 0.9,
      notes: [
        'Converge capture maps to Elavon transaction update',
        'Use transaction ID in URL path',
        'Set doCapture: true or capture amount'
      ]
    }
  ];

  constructor() {
    this.openApiService = new OpenApiService();
    this.fieldMappingService = new FieldMappingService();
  }

  async generateApiMappings(): Promise<ApiMapping[]> {
    Logger.info('Generating API mappings between Converge and Elavon');
    
    try {
      // Load both OpenAPI specifications
      await this.openApiService.loadSpecs();
      const convergeSpec = await this.openApiService.loadConvergeSpec();
      const elavonSpec = await this.openApiService.loadElavonSpec();

      if (!convergeSpec || !elavonSpec) {
        Logger.warn('One or both OpenAPI specifications not available, using predefined mappings');
        return this.getPredefinedMappings();
      }

      // Generate field mappings using the existing service
      const fieldMappingGroups = this.fieldMappingService.generateMappings(convergeSpec, elavonSpec);
      
      // Convert to API mappings
      const apiMappings: ApiMapping[] = [];
      
      for (const group of fieldMappingGroups) {
        const mapping: ApiMapping = {
          convergeEndpoint: group.endpoint,
          elavonEndpoint: this.findCorrespondingElavonEndpoint(group.endpoint),
          confidence: group.confidence,
          mappingType: group.confidence > 0.9 ? 'exact' : group.confidence > 0.7 ? 'similar' : 'inferred',
          fieldMappings: group.mappings,
          transformationRequired: group.mappings.some(m => m.transformationRequired),
          migrationNotes: this.generateMigrationNotes(group)
        };
        
        apiMappings.push(mapping);
      }

      // Add predefined mappings for common patterns not in OpenAPI
      apiMappings.push(...this.getPredefinedMappings());

      Logger.info(`Generated ${apiMappings.length} API mappings`);
      return apiMappings;
    } catch (error) {
      Logger.error('Error generating API mappings', error as Error);
      return this.getPredefinedMappings();
    }
  }

  getVariableMappings(): VariableMapping[] {
    return [...this.VARIABLE_MAPPINGS];
  }

  getEndpointMappings(): EndpointMapping[] {
    return [...this.ENDPOINT_MAPPINGS];
  }

  findConvergeToElavonMapping(convergePattern: string): ApiMapping | null {
    // Check predefined endpoint mappings first
    const endpointMapping = this.ENDPOINT_MAPPINGS.find(mapping => 
      mapping.converge.path.toLowerCase().includes(convergePattern.toLowerCase()) ||
      convergePattern.toLowerCase().includes(mapping.converge.path.toLowerCase())
    );

    if (endpointMapping) {
      return {
        convergeEndpoint: endpointMapping.converge.path,
        elavonEndpoint: endpointMapping.elavon.path,
        confidence: endpointMapping.confidence,
        mappingType: 'exact',
        fieldMappings: [],
        transformationRequired: true,
        migrationNotes: endpointMapping.notes
      };
    }

    // Check variable mappings
    const variableMapping = this.VARIABLE_MAPPINGS.find(mapping =>
      convergePattern.toLowerCase().includes(mapping.convergeVariable.toLowerCase())
    );

    if (variableMapping) {
      return {
        convergeEndpoint: convergePattern,
        elavonEndpoint: variableMapping.elavonVariable,
        confidence: variableMapping.confidence,
        mappingType: 'exact',
        fieldMappings: [],
        transformationRequired: true,
        migrationNotes: [variableMapping.description, variableMapping.example || '']
      };
    }

    return null;
  }

  generateMigrationCode(mapping: ApiMapping, language: string): string {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        return this.generateJavaScriptMigration(mapping);
      case 'java':
        return this.generateJavaMigration(mapping);
      case 'csharp':
        return this.generateCSharpMigration(mapping);
      case 'python':
        return this.generatePythonMigration(mapping);
      default:
        return this.generateGenericMigration(mapping);
    }
  }

  private getPredefinedMappings(): ApiMapping[] {
    return this.ENDPOINT_MAPPINGS.map(endpointMapping => ({
      convergeEndpoint: endpointMapping.converge.path,
      elavonEndpoint: endpointMapping.elavon.path,
      confidence: endpointMapping.confidence,
      mappingType: 'exact' as const,
      fieldMappings: [],
      transformationRequired: true,
      migrationNotes: endpointMapping.notes
    }));
  }

  private findCorrespondingElavonEndpoint(convergeEndpoint: string): string {
    const mapping = this.ENDPOINT_MAPPINGS.find(m => 
      m.converge.path === convergeEndpoint
    );
    return mapping?.elavon.path || '/transactions';
  }

  private generateMigrationNotes(group: MappingGroup): string[] {
    const notes: string[] = [];
    
    notes.push(`Endpoint: ${group.endpoint}`);
    notes.push(`Confidence: ${Math.round(group.confidence * 100)}%`);
    
    if (group.mappings.length > 0) {
      notes.push(`Field mappings: ${group.mappings.length} fields mapped`);
      
      const transformationCount = group.mappings.filter(m => m.transformationRequired).length;
      if (transformationCount > 0) {
        notes.push(`${transformationCount} fields require transformation`);
      }
    }

    return notes;
  }

  private generateJavaScriptMigration(mapping: ApiMapping): string {
    return `
// Converge to Elavon L1 Migration
// Original: ${mapping.convergeEndpoint}
// Target: ${mapping.elavonEndpoint}

// Before (Converge):
/*
const convergeRequest = {
  ssl_merchant_id: "your_merchant_id",
  ssl_user_id: "your_user_id", 
  ssl_pin: "your_pin",
  ssl_amount: "10.00",
  ssl_card_number: "4111111111111111",
  ssl_exp_date: "1225",
  ssl_transaction_type: "ccsale"
};
*/

// After (Elavon L1):
const elavonRequest = {
  total: {
    amount: "10.00",
    currency: "USD"
  },
  card: {
    number: "4111111111111111",
    expirationMonth: "12",
    expirationYear: "25"
  },
  doCapture: true // true for sale, false for auth
};

// API Call:
const response = await fetch('https://api.eu.convergepay.com/transactions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + btoa(merchantId + ':' + apiKey),
    'Accept-Version': '1'
  },
  body: JSON.stringify(elavonRequest)
});
`;
  }

  private generateJavaMigration(mapping: ApiMapping): string {
    return `
// Converge to Elavon L1 Migration (Java)
// Original: ${mapping.convergeEndpoint}
// Target: ${mapping.elavonEndpoint}

// Before (Converge):
/*
Map<String, String> convergeParams = new HashMap<>();
convergeParams.put("ssl_merchant_id", "your_merchant_id");
convergeParams.put("ssl_user_id", "your_user_id");
convergeParams.put("ssl_pin", "your_pin");
convergeParams.put("ssl_amount", "10.00");
convergeParams.put("ssl_card_number", "4111111111111111");
convergeParams.put("ssl_exp_date", "1225");
convergeParams.put("ssl_transaction_type", "ccsale");
*/

// After (Elavon L1):
@RestController
public class PaymentController {
    
    @PostMapping("/process-payment")
    public ResponseEntity<TransactionResponse> processPayment(@RequestBody PaymentRequest request) {
        TransactionRequest elavonRequest = TransactionRequest.builder()
            .total(Total.builder()
                .amount("10.00")
                .currency("USD")
                .build())
            .card(Card.builder()
                .number("4111111111111111")
                .expirationMonth("12")
                .expirationYear("25")
                .build())
            .doCapture(true)
            .build();
            
        // Make API call to Elavon
        return elavonApiClient.createTransaction(elavonRequest);
    }
}
`;
  }

  private generateCSharpMigration(mapping: ApiMapping): string {
    return `
// Converge to Elavon L1 Migration (C#)
// Original: ${mapping.convergeEndpoint}
// Target: ${mapping.elavonEndpoint}

// Before (Converge):
/*
var convergeRequest = new Dictionary<string, string>
{
    {"ssl_merchant_id", "your_merchant_id"},
    {"ssl_user_id", "your_user_id"},
    {"ssl_pin", "your_pin"},
    {"ssl_amount", "10.00"},
    {"ssl_card_number", "4111111111111111"},
    {"ssl_exp_date", "1225"},
    {"ssl_transaction_type", "ccsale"}
};
*/

// After (Elavon L1):
public class PaymentController : ControllerBase
{
    [HttpPost("process-payment")]
    public async Task<ActionResult<TransactionResponse>> ProcessPayment([FromBody] PaymentRequest request)
    {
        var elavonRequest = new TransactionRequest
        {
            Total = new Total
            {
                Amount = "10.00",
                Currency = "USD"
            },
            Card = new Card
            {
                Number = "4111111111111111",
                ExpirationMonth = "12",
                ExpirationYear = "25"
            },
            DoCapture = true
        };
        
        // Make API call to Elavon
        var response = await _elavonApiClient.CreateTransactionAsync(elavonRequest);
        return Ok(response);
    }
}
`;
  }

  private generatePythonMigration(mapping: ApiMapping): string {
    return `
# Converge to Elavon L1 Migration (Python)
# Original: ${mapping.convergeEndpoint}
# Target: ${mapping.elavonEndpoint}

# Before (Converge):
"""
converge_request = {
    "ssl_merchant_id": "your_merchant_id",
    "ssl_user_id": "your_user_id",
    "ssl_pin": "your_pin",
    "ssl_amount": "10.00",
    "ssl_card_number": "4111111111111111",
    "ssl_exp_date": "1225",
    "ssl_transaction_type": "ccsale"
}
"""

# After (Elavon L1):
import requests
from typing import Dict, Any

def process_payment(payment_data: Dict[str, Any]) -> Dict[str, Any]:
    elavon_request = {
        "total": {
            "amount": "10.00",
            "currency": "USD"
        },
        "card": {
            "number": "4111111111111111",
            "expirationMonth": "12",
            "expirationYear": "25"
        },
        "doCapture": True  # True for sale, False for auth
    }
    
    # API call to Elavon
    response = requests.post(
        "https://api.eu.convergepay.com/transactions",
        json=elavon_request,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Basic {base64_encode(merchant_id + ':' + api_key)}",
            "Accept-Version": "1"
        }
    )
    
    return response.json()
`;
  }

  private generateGenericMigration(mapping: ApiMapping): string {
    return `
// Converge to Elavon L1 Migration
// Original: ${mapping.convergeEndpoint}
// Target: ${mapping.elavonEndpoint}
// Confidence: ${Math.round(mapping.confidence * 100)}%

Migration Notes:
${mapping.migrationNotes.map(note => `- ${note}`).join('\n')}

Key Changes Required:
1. Update endpoint URL to Elavon L1 API
2. Transform request structure from Converge format to Elavon format
3. Update authentication method to use API keys
4. Handle response format differences
5. Update error handling for new response structure

Field Mappings:
${mapping.fieldMappings.map(fm => 
  `- ${fm.sourceField} → ${fm.targetField} (${Math.round(fm.confidence * 100)}% confidence)`
).join('\n')}
`;
  }
}