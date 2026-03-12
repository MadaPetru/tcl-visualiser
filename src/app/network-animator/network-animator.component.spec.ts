import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NetworkAnimatorComponent } from './network-animator.component';

describe('NetworkAnimatorComponent', () => {
  let component: NetworkAnimatorComponent;
  let fixture: ComponentFixture<NetworkAnimatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NetworkAnimatorComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NetworkAnimatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
