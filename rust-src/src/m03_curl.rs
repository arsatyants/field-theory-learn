pub fn run() {
    let h = 1e-6;
    let (x, y, z) = (1.5, 2.0, 0.5);
    let fx = |_x: f64, y: f64, z: f64| y*z;
    let fy = |x: f64, _y: f64, z: f64| x*z;
    let fz = |x: f64, y: f64, _z: f64| x*y;
    let rot_x = (fz(x, y+h, z) - fz(x, y-h, z))/(2.0*h)
              - (fy(x, y, z+h) - fy(x, y, z-h))/(2.0*h);
    let rot_y = (fx(x, y, z+h) - fx(x, y, z-h))/(2.0*h)
              - (fz(x+h, y, z) - fz(x-h, y, z))/(2.0*h);
    let rot_z = (fy(x+h, y, z) - fy(x-h, y, z))/(2.0*h)
              - (fx(x, y+h, z) - fx(x, y-h, z))/(2.0*h);
    println!("Поле: F = (yz, xz, xy)");
    println!("Точка: ({}, {}, {})", x, y, z);
    println!("Численный  rot F = ({:.2e}, {:.2e}, {:.2e})", rot_x, rot_y, rot_z);
    println!("Аналитический     = (0, 0, 0)");
}
