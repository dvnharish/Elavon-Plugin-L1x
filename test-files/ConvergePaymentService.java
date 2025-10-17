// Sample Java file with Converge API usage for testing
package com.example.payment;

import com.converge.api.ConvergeClient;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.*;

// Regex Scan: This will find endpoint URLs
public class ConvergePaymentService {
    private static final String CONVERGE_API_URL = "https://api.converge.elavonaws.com/v1";
    private static final String UAT_ENDPOINT = "https://uat.api.converge.eu.elavonaws.com";
    
    private ConvergeClient client;

    // AST Scan: This will find service classes
    @Service
    public class PaymentService {
        
        // AST Scan: This will find method definitions
        public PaymentResponseDTO processPayment(PaymentRequestDTO request) {
            try {
                return client.processTransaction(request);
            } catch (Exception e) {
                throw new RuntimeException("Payment processing failed", e);
            }
        }

        public RefundResponseDTO processRefund(RefundRequestDTO request) {
            try {
                return client.processRefund(request);
            } catch (Exception e) {
                throw new RuntimeException("Refund processing failed", e);
            }
        }
    }

    // AST Scan: This will find controller classes
    @RestController
    @RequestMapping("/api/payments")
    public class PaymentController {
        
        @PostMapping("/process")
        public PaymentResponseDTO processPayment(@RequestBody PaymentRequestDTO request) {
            return paymentService.processPayment(request);
        }

        @PostMapping("/refund")
        public RefundResponseDTO processRefund(@RequestBody RefundRequestDTO request) {
            return paymentService.processRefund(request);
        }
    }
}

// DTO Scan: This will find Data Transfer Objects
class PaymentRequestDTO {
    private String merchantId;
    private String apiKey;
    private String transactionId;
    private Long amount;
    private String currency;
    
    // Getters and setters...
}

class PaymentResponseDTO {
    private String transactionId;
    private String status;
    private Long amount;
    private java.util.Date timestamp;
    
    // Getters and setters...
}

class RefundRequestDTO {
    private String transactionId;
    private Long amount;
    private String reason;
    
    // Getters and setters...
}

class RefundResponseDTO {
    private String refundId;
    private String status;
    private Long amount;
    
    // Getters and setters...
}