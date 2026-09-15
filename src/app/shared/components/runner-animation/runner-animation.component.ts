import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-runner-animation',
  templateUrl: './runner-animation.component.html',
  styleUrls: ['./runner-animation.component.scss']
})
export class RunnerAnimationComponent {
  @Input() completionPercentage = 75; // dynamic progress based on registered/leads
}
