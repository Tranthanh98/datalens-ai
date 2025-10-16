/**
 * Embedding Service
 * Generates vector embeddings for table descriptions using Transformers.js
 */

import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

class EmbeddingService {
  private model: FeatureExtractionPipeline | null = null;
  private modelName = "Xenova/multilingual-e5-base";
  private isInitializing = false;

  /**
   * Initialize the embedding model
   * Model is lazy-loaded on first use
   */
  private async initializeModel(): Promise<FeatureExtractionPipeline> {
    if (this.model) {
      return this.model;
    }

    if (this.isInitializing) {
      // Wait for initialization to complete
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (this.model) {
        return this.model;
      }
    }

    this.isInitializing = true;

    try {
      console.log(`Loading embedding model: ${this.modelName}...`);
      this.model = await pipeline("feature-extraction", this.modelName);
      console.log("✓ Embedding model loaded successfully");
      return this.model;
    } catch (error) {
      console.error("Failed to load embedding model:", error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }

    try {
      const model = await this.initializeModel();

      // Generate embedding with mean pooling and normalization
      const output = await model(text, {
        pooling: "mean",
        normalize: true,
      });

      // Extract the embedding as array
      const embedding = Array.from(output.data as Float32Array);

      return embedding;
    } catch (error) {
      console.error("Failed to generate embedding:", error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }

    return embeddings;
  }

  /**
   * Generate embedding for a table based on its description
   * Combines table name and description for better context
   */
  async generateTableEmbedding(
    tableName: string,
    tableDescription: string
  ): Promise<number[]> {
    // Combine table name and description for richer context
    const text = `Table: ${tableName}. Description: ${tableDescription}`;
    return this.generateEmbedding(text);
  }

  /**
   * Generate embeddings for all tables in a schema
   */
  async generateSchemaTableEmbeddings(
    tables: Array<{ tableName: string; tableDescription: string }>
  ): Promise<Map<string, number[]>> {
    const embeddings = new Map<string, number[]>();

    console.log(`Generating embeddings for ${tables.length} tables...`);

    for (const table of tables) {
      if (table.tableDescription) {
        const embedding = await this.generateTableEmbedding(
          table.tableName,
          table.tableDescription
        );
        embeddings.set(table.tableName, embedding);
      }
    }

    console.log(`✓ Generated embeddings for ${embeddings.size} tables`);

    return embeddings;
  }

  /**
   * Get the dimension of embeddings produced by this model
   */
  async getEmbeddingDimension(): Promise<number> {
    // Generate a test embedding to get dimension
    const testEmbedding = await this.generateEmbedding("test");
    return testEmbedding.length;
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
