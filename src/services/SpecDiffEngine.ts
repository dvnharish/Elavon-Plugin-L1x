import { Logger } from '../utils/logger';

export interface SpecDifference {
  type: 'added' | 'removed' | 'modified';
  path: string;
  oldValue?: any;
  newValue?: any;
  description: string;
  impact: 'breaking' | 'non-breaking' | 'enhancement';
  confidence: number;
}

export interface DiffSummary {
  totalDifferences: number;
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  breakingChanges: number;
  nonBreakingChanges: number;
  enhancements: number;
}

export class SpecDiffEngine {
  calculateDifferences(spec1: any, spec2: any): SpecDifference[] {
    Logger.info('Calculating differences between OpenAPI specifications');
    
    const differences: SpecDifference[] = [];
    
    try {
      // Compare paths (endpoints)
      this.comparePaths(spec1.paths || {}, spec2.paths || {}, differences);
      
      // Compare components (schemas, responses, etc.)
      this.compareComponents(spec1.components || {}, spec2.components || {}, differences);
      
      // Compare info and metadata
      this.compareInfo(spec1.info || {}, spec2.info || {}, differences);
      
      // Compare servers
      this.compareServers(spec1.servers || [], spec2.servers || [], differences);
      
      Logger.info(`Found ${differences.length} differences between specifications`);
      return differences;
    } catch (error) {
      Logger.error('Error calculating spec differences', error as Error);
      return [];
    }
  }

  generateSummary(differences: SpecDifference[]): DiffSummary {
    const summary: DiffSummary = {
      totalDifferences: differences.length,
      addedCount: 0,
      removedCount: 0,
      modifiedCount: 0,
      breakingChanges: 0,
      nonBreakingChanges: 0,
      enhancements: 0
    };

    differences.forEach(diff => {
      // Count by type
      switch (diff.type) {
        case 'added':
          summary.addedCount++;
          break;
        case 'removed':
          summary.removedCount++;
          break;
        case 'modified':
          summary.modifiedCount++;
          break;
      }

      // Count by impact
      switch (diff.impact) {
        case 'breaking':
          summary.breakingChanges++;
          break;
        case 'non-breaking':
          summary.nonBreakingChanges++;
          break;
        case 'enhancement':
          summary.enhancements++;
          break;
      }
    });

    return summary;
  } 
 private comparePaths(paths1: any, paths2: any, differences: SpecDifference[]): void {
    const allPaths = new Set([...Object.keys(paths1), ...Object.keys(paths2)]);
    
    allPaths.forEach(path => {
      const path1 = paths1[path];
      const path2 = paths2[path];
      
      if (!path1 && path2) {
        // Path added in spec2
        differences.push({
          type: 'added',
          path: `paths.${path}`,
          newValue: path2,
          description: `New endpoint added: ${path}`,
          impact: 'enhancement',
          confidence: 1.0
        });
      } else if (path1 && !path2) {
        // Path removed in spec2
        differences.push({
          type: 'removed',
          path: `paths.${path}`,
          oldValue: path1,
          description: `Endpoint removed: ${path}`,
          impact: 'breaking',
          confidence: 1.0
        });
      } else if (path1 && path2) {
        // Path exists in both, compare methods
        this.compareMethods(path1, path2, `paths.${path}`, differences);
      }
    });
  }

  private compareMethods(pathObj1: any, pathObj2: any, basePath: string, differences: SpecDifference[]): void {
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];
    
    methods.forEach(method => {
      const method1 = pathObj1[method];
      const method2 = pathObj2[method];
      
      if (!method1 && method2) {
        differences.push({
          type: 'added',
          path: `${basePath}.${method}`,
          newValue: method2,
          description: `New ${method.toUpperCase()} method added`,
          impact: 'enhancement',
          confidence: 1.0
        });
      } else if (method1 && !method2) {
        differences.push({
          type: 'removed',
          path: `${basePath}.${method}`,
          oldValue: method1,
          description: `${method.toUpperCase()} method removed`,
          impact: 'breaking',
          confidence: 1.0
        });
      } else if (method1 && method2) {
        this.compareMethodDetails(method1, method2, `${basePath}.${method}`, differences);
      }
    });
  }

  private compareMethodDetails(method1: any, method2: any, basePath: string, differences: SpecDifference[]): void {
    // Compare parameters
    this.compareParameters(method1.parameters || [], method2.parameters || [], `${basePath}.parameters`, differences);
    
    // Compare request body
    if (method1.requestBody || method2.requestBody) {
      this.compareRequestBody(method1.requestBody, method2.requestBody, `${basePath}.requestBody`, differences);
    }
    
    // Compare responses
    this.compareResponses(method1.responses || {}, method2.responses || {}, `${basePath}.responses`, differences);
    
    // Compare summary and description
    if (method1.summary !== method2.summary) {
      differences.push({
        type: 'modified',
        path: `${basePath}.summary`,
        oldValue: method1.summary,
        newValue: method2.summary,
        description: 'Method summary changed',
        impact: 'non-breaking',
        confidence: 1.0
      });
    }
  }

  private compareParameters(params1: any[], params2: any[], basePath: string, differences: SpecDifference[]): void {
    const paramMap1 = new Map(params1.map(p => [p.name + p.in, p]));
    const paramMap2 = new Map(params2.map(p => [p.name + p.in, p]));
    
    // Check for added parameters
    paramMap2.forEach((param, key) => {
      if (!paramMap1.has(key)) {
        differences.push({
          type: 'added',
          path: `${basePath}.${param.name}`,
          newValue: param,
          description: `New ${param.in} parameter '${param.name}' added`,
          impact: param.required ? 'breaking' : 'non-breaking',
          confidence: 1.0
        });
      }
    });
    
    // Check for removed parameters
    paramMap1.forEach((param, key) => {
      if (!paramMap2.has(key)) {
        differences.push({
          type: 'removed',
          path: `${basePath}.${param.name}`,
          oldValue: param,
          description: `Parameter '${param.name}' removed`,
          impact: 'breaking',
          confidence: 1.0
        });
      }
    });
    
    // Check for modified parameters
    paramMap1.forEach((param1, key) => {
      const param2 = paramMap2.get(key);
      if (param2) {
        if (param1.required !== param2.required) {
          differences.push({
            type: 'modified',
            path: `${basePath}.${param1.name}.required`,
            oldValue: param1.required,
            newValue: param2.required,
            description: `Parameter '${param1.name}' required status changed`,
            impact: param2.required ? 'breaking' : 'non-breaking',
            confidence: 1.0
          });
        }
        
        if (param1.type !== param2.type) {
          differences.push({
            type: 'modified',
            path: `${basePath}.${param1.name}.type`,
            oldValue: param1.type,
            newValue: param2.type,
            description: `Parameter '${param1.name}' type changed`,
            impact: 'breaking',
            confidence: 1.0
          });
        }
      }
    });
  }

  private compareRequestBody(body1: any, body2: any, basePath: string, differences: SpecDifference[]): void {
    if (!body1 && body2) {
      differences.push({
        type: 'added',
        path: basePath,
        newValue: body2,
        description: 'Request body added',
        impact: 'breaking',
        confidence: 1.0
      });
    } else if (body1 && !body2) {
      differences.push({
        type: 'removed',
        path: basePath,
        oldValue: body1,
        description: 'Request body removed',
        impact: 'breaking',
        confidence: 1.0
      });
    } else if (body1 && body2) {
      if (body1.required !== body2.required) {
        differences.push({
          type: 'modified',
          path: `${basePath}.required`,
          oldValue: body1.required,
          newValue: body2.required,
          description: 'Request body required status changed',
          impact: body2.required ? 'breaking' : 'non-breaking',
          confidence: 1.0
        });
      }
    }
  } 
 private compareResponses(responses1: any, responses2: any, basePath: string, differences: SpecDifference[]): void {
    const allCodes = new Set([...Object.keys(responses1), ...Object.keys(responses2)]);
    
    allCodes.forEach(code => {
      const response1 = responses1[code];
      const response2 = responses2[code];
      
      if (!response1 && response2) {
        differences.push({
          type: 'added',
          path: `${basePath}.${code}`,
          newValue: response2,
          description: `New response code ${code} added`,
          impact: 'enhancement',
          confidence: 1.0
        });
      } else if (response1 && !response2) {
        differences.push({
          type: 'removed',
          path: `${basePath}.${code}`,
          oldValue: response1,
          description: `Response code ${code} removed`,
          impact: 'breaking',
          confidence: 1.0
        });
      }
    });
  }

  private compareComponents(components1: any, components2: any, differences: SpecDifference[]): void {
    const componentTypes = ['schemas', 'responses', 'parameters', 'examples', 'requestBodies', 'headers', 'securitySchemes'];
    
    componentTypes.forEach(type => {
      const comp1 = components1[type] || {};
      const comp2 = components2[type] || {};
      
      this.compareComponentType(comp1, comp2, `components.${type}`, differences);
    });
  }

  private compareComponentType(comp1: any, comp2: any, basePath: string, differences: SpecDifference[]): void {
    const allKeys = new Set([...Object.keys(comp1), ...Object.keys(comp2)]);
    
    allKeys.forEach(key => {
      const item1 = comp1[key];
      const item2 = comp2[key];
      
      if (!item1 && item2) {
        differences.push({
          type: 'added',
          path: `${basePath}.${key}`,
          newValue: item2,
          description: `New component '${key}' added`,
          impact: 'enhancement',
          confidence: 1.0
        });
      } else if (item1 && !item2) {
        differences.push({
          type: 'removed',
          path: `${basePath}.${key}`,
          oldValue: item1,
          description: `Component '${key}' removed`,
          impact: 'breaking',
          confidence: 1.0
        });
      } else if (item1 && item2) {
        // Deep comparison would go here for modified components
        if (JSON.stringify(item1) !== JSON.stringify(item2)) {
          differences.push({
            type: 'modified',
            path: `${basePath}.${key}`,
            oldValue: item1,
            newValue: item2,
            description: `Component '${key}' modified`,
            impact: 'breaking',
            confidence: 0.8
          });
        }
      }
    });
  }

  private compareInfo(info1: any, info2: any, differences: SpecDifference[]): void {
    const fields = ['title', 'version', 'description'];
    
    fields.forEach(field => {
      if (info1[field] !== info2[field]) {
        differences.push({
          type: 'modified',
          path: `info.${field}`,
          oldValue: info1[field],
          newValue: info2[field],
          description: `API ${field} changed`,
          impact: 'non-breaking',
          confidence: 1.0
        });
      }
    });
  }

  private compareServers(servers1: any[], servers2: any[], differences: SpecDifference[]): void {
    if (servers1.length !== servers2.length) {
      differences.push({
        type: 'modified',
        path: 'servers',
        oldValue: servers1,
        newValue: servers2,
        description: 'Server configuration changed',
        impact: 'breaking',
        confidence: 1.0
      });
    }
  }
}