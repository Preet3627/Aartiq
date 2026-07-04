/**
 * Sample Weather Plugin
 * Demonstrates plugin command registration and execution
 */

const Plugin = require('../../src/lib/plugin-sdk').Plugin;

class WeatherPlugin extends Plugin {
  constructor() {
    super({
      id: 'sample-weather-plugin',
      name: 'Weather Plugin',
      version: '1.0.0',
      description: 'Get weather information for any location',
      type: 'command',
      permissions: ['network'],
    });

    this.registerCommand({
      id: 'get-weather',
      name: 'Get Weather',
      description: 'Get current weather for a city',
      params: [
        { name: 'city', type: 'string', required: true, description: 'City name' }
      ],
      handler: async (params) => {
        const { city } = params;
        
        this.context.log(`Fetching weather for ${city}...`);
        
        // Simulate weather API call
        const weatherData = await this.simulateWeatherAPI(city);
        
        return {
          success: true,
          output: `Weather for ${city}:\n` +
            `🌡️ Temperature: ${weatherData.temp}°C\n` +
            `💧 Humidity: ${weatherData.humidity}%\n` +
            `🌤️ Condition: ${weatherData.condition}\n` +
            `💨 Wind: ${weatherData.wind} km/h`
        };
      }
    });
  }

  async simulateWeatherAPI(city) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return simulated data
    return {
      temp: Math.floor(Math.random() * 30) + 5,
      humidity: Math.floor(Math.random() * 60) + 40,
      condition: ['Sunny', 'Cloudy', 'Partly Cloudy', 'Rainy'][Math.floor(Math.random() * 4)],
      wind: Math.floor(Math.random() * 30)
    };
  }
}

module.exports = new WeatherPlugin();
