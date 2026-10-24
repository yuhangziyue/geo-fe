// Only the chart types and components the dashboard uses. Static named imports are what lets the bundler
// drop the rest of echarts; EChart.tsx loads this module lazily, so none of it is in the first-load bundle.
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { init, use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export { init };
