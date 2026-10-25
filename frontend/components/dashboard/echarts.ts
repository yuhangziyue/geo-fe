// Only the chart types and components the dashboard uses. Static named imports are what lets the bundler
// drop the rest of echarts; EChart.tsx loads this module lazily, so none of it is in the first-load bundle.
import { BarChart, LineChart, ScatterChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { init, registerTheme, use as registerModules } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { geoTheme } from '../../design/chartTheme';

registerModules([BarChart, LineChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
registerTheme('geo', geoTheme);

export { init };
