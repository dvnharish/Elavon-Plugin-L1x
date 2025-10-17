import { Logger } from '../utils/logger';

export interface FieldMapping {
  sourcePath: string;
  targetPath: string;
  sourceField: string;
  targetField: string;
  sourceType: string;
  targetType: string;
  confidence: number;
  mappingType: 'exact' | 'similar' | 'inferred' | 'manual';
  transformationRequired: boolean;
  transformationRule?: string | undefined;
}

export interface MappingGroup {
  endpoint: string;
  method: string;
  mappings: FieldMapping[];
  confidence: number;
}

export class FieldMappingService {
  generateMappings(spec1: any, spec2: any): MappingGroup[] {
    Logger.info('Generating field mappings between specifications');
    
    const mappingGroups: MappingGroup[] = [];
    
    try {
      const paths1 = spec1.paths || {};
      const paths2 = spec2.paths || {};
      
      // Find common endpoints
      const commonPaths = this.findCommonPaths(paths1, paths2);
      
      commonPaths.forEach(pathInfo => {
        const group = this.generateEndpointMappings(pathInfo, paths1, paths2);
        if (group.mappings.length > 0) {
          mappingGroups.push(group);
        }
      });
      
      Logger.info(`Generated ${mappingGroups.length} mapping groups`);
      return mappingGroups;
    } catch (error) {
      Logger.error('Error generating field mappings', error as Error);
      return [];
    }
  }

  private findCommonPaths(paths1: any, paths2: any): Array<{path1: string, path2: string, similarity: number}> {
    const commonPaths: Array<{path1: string, path2: string, similarity: number}> = [];
    
    Object.keys(paths1).forEach(path1 => {
      Object.keys(paths2).forEach(path2 => {
        const similarity = this.calculatePathSimilarity(path1, path2);
        if (similarity > 0.6) { // Threshold for considering paths similar
          commonPaths.push({ path1, path2, similarity });
        }
      });
    });
    
    // Sort by similarity and remove duplicates
    return commonPaths
      .sort((a, b) => b.similarity - a.similarity)
      .filter((item, index, arr) => 
        arr.findIndex(other => other.path1 === item.path1) === index
      );
  }

  private calculatePathSimilarity(path1: string, path2: string): number {
    // Simple similarity calculation based on path segments
    const segments1 = path1.split('/').filter(s => s.length > 0);
    const segments2 = path2.split('/').filter(s => s.length > 0);
    
    if (segments1.length === 0 && segments2.length === 0) {
      return 1.0;
    }
    
    const maxLength = Math.max(segments1.length, segments2.length);
    let matches = 0;
    
    for (let i = 0; i < maxLength; i++) {
      const seg1 = segments1[i] || '';
      const seg2 = segments2[i] || '';
      
      if (seg1 === seg2) {
        matches++;
      } else if (this.isParameterSegment(seg1) && this.isParameterSegment(seg2)) {
        matches += 0.8; // Parameter segments are similar but not exact
      } else if (this.calculateStringSimilarity(seg1, seg2) > 0.7) {
        matches += 0.6; // Similar strings
      }
    }
    
    return matches / maxLength;
  }

  private isParameterSegment(segment: string): boolean {
    return segment.startsWith('{') && segment.endsWith('}');
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) {return 1.0;}
    if (str1.length === 0 || str2.length === 0) {return 0.0;}
    
    // Simple Levenshtein distance-based similarity
    const maxLength = Math.max(str1.length, str2.length);
    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    return 1 - (distance / maxLength);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0]![i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j]![0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1]! + 1,     // deletion
          matrix[j - 1]![i]! + 1,     // insertion
          matrix[j - 1]![i - 1]! + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length]![str1.length]!;
  }

  private generateEndpointMappings(pathInfo: {path1: string, path2: string, similarity: number}, paths1: any, paths2: any): MappingGroup {
    const { path1, path2 } = pathInfo;
    const pathObj1 = paths1[path1];
    const pathObj2 = paths2[path2];
    
    const mappings: FieldMapping[] = [];
    const methods = ['get', 'post', 'put', 'delete', 'patch'];
    
    methods.forEach(method => {
      const method1 = pathObj1[method];
      const method2 = pathObj2[method];
      
      if (method1 && method2) {
        // Map request parameters
        this.mapParameters(method1.parameters || [], method2.parameters || [], `${path1}.${method}`, mappings);
        
        // Map request body
        if (method1.requestBody && method2.requestBody) {
          this.mapRequestBody(method1.requestBody, method2.requestBody, `${path1}.${method}`, mappings);
        }
        
        // Map response schemas
        this.mapResponses(method1.responses || {}, method2.responses || {}, `${path1}.${method}`, mappings);
      }
    });
    
    const avgConfidence = mappings.length > 0 
      ? mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length 
      : 0;
    
    return {
      endpoint: path1,
      method: 'multiple',
      mappings,
      confidence: avgConfidence
    };
  }

  private mapParameters(params1: any[], params2: any[], basePath: string, mappings: FieldMapping[]): void {
    params1.forEach(param1 => {
      const bestMatch = this.findBestParameterMatch(param1, params2);
      if (bestMatch) {
        mappings.push({
          sourcePath: `${basePath}.parameters`,
          targetPath: `${basePath}.parameters`,
          sourceField: param1.name,
          targetField: bestMatch.param.name,
          sourceType: param1.schema?.type || 'unknown',
          targetType: bestMatch.param.schema?.type || 'unknown',
          confidence: bestMatch.confidence,
          mappingType: bestMatch.confidence > 0.9 ? 'exact' : 'similar',
          transformationRequired: param1.schema?.type !== bestMatch.param.schema?.type,
          transformationRule: this.generateTransformationRule(param1.schema?.type, bestMatch.param.schema?.type)
        });
      }
    });
  }

  private findBestParameterMatch(param: any, candidates: any[]): {param: any; confidence: number} | null {
    let bestMatch: {param: any; confidence: number} | null = null;
    
    candidates.forEach(candidate => {
      let confidence = 0;
      
      // Exact name match
      if (param.name === candidate.name) {
        confidence = 1.0;
      } else {
        // Similar name match
        confidence = this.calculateStringSimilarity(param.name, candidate.name);
      }
      
      // Boost confidence for same parameter location (query, path, header)
      if (param.in === candidate.in) {
        confidence += 0.2;
      }
      
      // Boost confidence for same type
      if (param.schema?.type === candidate.schema?.type) {
        confidence += 0.1;
      }
      
      confidence = Math.min(confidence, 1.0);
      
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { param: candidate, confidence };
      }
    });
    
    if (bestMatch !== null && (bestMatch as {param: any; confidence: number}).confidence > 0.5) {
      return bestMatch;
    }
    return null;
  }

  private mapRequestBody(body1: any, body2: any, basePath: string, mappings: FieldMapping[]): void {
    // Extract schema from request body
    const schema1 = this.extractSchema(body1);
    const schema2 = this.extractSchema(body2);
    
    if (schema1 && schema2) {
      this.mapSchemaFields(schema1, schema2, `${basePath}.requestBody`, mappings);
    }
  }

  private mapResponses(responses1: any, responses2: any, basePath: string, mappings: FieldMapping[]): void {
    // Focus on successful responses (200, 201, etc.)
    const successCodes = ['200', '201', '202', '204'];
    
    successCodes.forEach(code => {
      const response1 = responses1[code];
      const response2 = responses2[code];
      
      if (response1 && response2) {
        const schema1 = this.extractSchema(response1);
        const schema2 = this.extractSchema(response2);
        
        if (schema1 && schema2) {
          this.mapSchemaFields(schema1, schema2, `${basePath}.responses.${code}`, mappings);
        }
      }
    });
  }

  private extractSchema(bodyOrResponse: any): any {
    // Try to extract schema from various content types
    const content = bodyOrResponse.content;
    if (!content) {return null;}
    
    const contentTypes = ['application/json', 'application/xml', 'text/plain'];
    
    for (const contentType of contentTypes) {
      if (content[contentType]?.schema) {
        return content[contentType].schema;
      }
    }
    
    return null;
  }

  private mapSchemaFields(schema1: any, schema2: any, basePath: string, mappings: FieldMapping[]): void {
    if (!schema1.properties || !schema2.properties) {return;}
    
    Object.keys(schema1.properties).forEach(field1 => {
      const prop1 = schema1.properties[field1];
      const bestMatch = this.findBestFieldMatch(field1, prop1, schema2.properties);
      
      if (bestMatch) {
        mappings.push({
          sourcePath: basePath,
          targetPath: basePath,
          sourceField: field1,
          targetField: bestMatch.field,
          sourceType: prop1.type || 'object',
          targetType: bestMatch.property.type || 'object',
          confidence: bestMatch.confidence,
          mappingType: bestMatch.confidence > 0.9 ? 'exact' : 'similar',
          transformationRequired: prop1.type !== bestMatch.property.type,
          transformationRule: this.generateTransformationRule(prop1.type, bestMatch.property.type)
        });
      }
    });
  }

  private findBestFieldMatch(fieldName: string, property: any, candidates: any): {field: string; property: any; confidence: number} | null {
    let bestMatch: {field: string; property: any; confidence: number} | null = null;
    
    Object.keys(candidates).forEach(candidateField => {
      const candidateProperty = candidates[candidateField];
      let confidence = 0;
      
      // Exact name match
      if (fieldName === candidateField) {
        confidence = 1.0;
      } else {
        // Similar name match
        confidence = this.calculateStringSimilarity(fieldName, candidateField);
      }
      
      // Boost confidence for same type
      if (property.type === candidateProperty.type) {
        confidence += 0.2;
      }
      
      // Boost confidence for same format
      if (property.format === candidateProperty.format) {
        confidence += 0.1;
      }
      
      confidence = Math.min(confidence, 1.0);
      
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { field: candidateField, property: candidateProperty, confidence };
      }
    });
    
    if (bestMatch !== null && (bestMatch as {field: string; property: any; confidence: number}).confidence > 0.4) {
      return bestMatch;
    }
    return null;
  }

  private generateTransformationRule(sourceType: string, targetType: string): string | undefined {
    if (!sourceType || !targetType || sourceType === targetType) {
      return undefined;
    }
    
    const transformations: Record<string, Record<string, string>> = {
      'string': {
        'integer': 'Convert string to integer using parseInt()',
        'number': 'Convert string to number using parseFloat()',
        'boolean': 'Convert string to boolean (true/false)'
      },
      'integer': {
        'string': 'Convert integer to string using toString()',
        'number': 'Integer is compatible with number type'
      },
      'number': {
        'string': 'Convert number to string using toString()',
        'integer': 'Round number to integer using Math.round()'
      },
      'boolean': {
        'string': 'Convert boolean to string ("true"/"false")'
      }
    };
    
    return transformations[sourceType]?.[targetType] || `Manual conversion required from ${sourceType} to ${targetType}`;
  }
}