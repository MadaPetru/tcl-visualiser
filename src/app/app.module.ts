import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { NetworkAnimatorComponent } from './network-animator/network-animator.component';

@NgModule({
  declarations: [
    AppComponent,
    NetworkAnimatorComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
