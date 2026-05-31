output "ec2_public_ip" {
  value = aws_instance.falkenwacht_server.public_ip
}

output "rds_endpoint" {
  value = aws_db_instance.falkenwacht_db.address
}
