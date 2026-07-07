const { Plugin } = require('../../src/lib/plugin-sdk');

class WeatherPlugin extends Plugin {
  constructor() {
    super({
      id: 'sample-weather-plugin',
      name: 'Weather Plugin',
      version: '1.0.0',
      description: 'Get weather information for any location using web search',
      type: 'command',
      permissions: ['network'],
    });
  }

  async onLoad() {
    this.context.log('Weather plugin loaded');
    this.registerCommand({
      id: 'get-weather',
      name: 'Get Weather',
      description: 'Get current weather for a city',
      params: [
        { name: 'city', type: 'string', required: true, description: 'City name' }
      ],
      handler: async (params) => {
        const { city } = params;

        if (!city) {
          return { success: false, output: 'Please provide a city name.' };
        }

        this.context.log(`Fetching weather for ${city}...`);

        try {
          const data = await this.context.fetch(
            `https://wttr.in/${encodeURIComponent(city)}?format=%t|%h|%w|%C`
          );

          const parts = data.split('|');
          if (parts.length >= 4) {
            const [temp, humidity, wind, condition] = parts;
            return {
              success: true,
              output: [
                `Weather for ${city}:`,
                `🌡️ Temperature: ${temp}`,
                `💧 Humidity: ${humidity}`,
                `🌤️ Condition: ${condition.trim()}`,
                `💨 Wind: ${wind}`,
              ].join('\n'),
            };
          }
        } catch {}

        const simulated = await this._simulateWeather(city);
        return {
          success: true,
          output: `Weather for ${city} (simulated):\n🌡️ ${simulated.temp}°C\n💧 ${simulated.humidity}%\n🌤️ ${simulated.condition}\n💨 ${simulated.wind} km/h`,
        };
      },
    });
  }

  async _simulateWeather(city) {
    await new Promise(r => setTimeout(r, 300));
    const conditions = ['Sunny', 'Cloudy', 'Partly Cloudy', 'Rainy', 'Clear'];
    return {
      temp: Math.floor(Math.random() * 35) + 5,
      humidity: Math.floor(Math.random() * 60) + 40,
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      wind: Math.floor(Math.random() * 30),
    };
  }
}

module.exports = new WeatherPlugin();
